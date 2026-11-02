import type { Auth } from "@pisto/auth";
import {
  type BusinessChangeResource,
  type RealtimeServerMessage,
  realtimeClientMessageSchema,
} from "@pisto/contracts";
import { type Database, member } from "@pisto/db";
import { and, eq } from "drizzle-orm";

import { ApiError } from "./errors.ts";
import { requireSession, toProductActor } from "./session.ts";

export const realtimePath = "/v1/realtime";

/** The part of a server-side WebSocket the hub needs; Bun and Workers sockets both fit. */
export interface RealtimeSocket {
  send(message: string): unknown;
  close(code?: number, reason?: string): unknown;
}

const resourcePrefixes: ReadonlyArray<readonly [string, BusinessChangeResource]> = [
  ["/v1/sales", "sales"],
  ["/v1/catalog", "catalog"],
  ["/v1/inventory", "inventory"],
  ["/v1/cash", "cash"],
  ["/v1/expenses", "expenses"],
  ["/v1/customers", "customers"],
  ["/v1/receivables", "receivables"],
  ["/v1/receivable-payments", "receivables"],
  ["/v1/suppliers", "purchases"],
  ["/v1/purchases", "purchases"],
  ["/v1/payables", "purchases"],
];

/** The business area a successful write to this path changed, if it changes business data. */
export function changedResource(path: string): BusinessChangeResource | null {
  for (const [prefix, resource] of resourcePrefixes) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return resource;
  }
  return null;
}

/**
 * Fans committed-change notices out to the open sockets of one API process. Each deployment runs
 * the API in one process (the Bun server locally, one Durable Object on Workers), so in-memory
 * subscriptions reach every connected device.
 */
export class RealtimeHub {
  private readonly subscribers = new Map<string, Set<RealtimeSocket>>();

  subscribe(businessId: string, socket: RealtimeSocket): () => void {
    let sockets = this.subscribers.get(businessId);
    if (!sockets) {
      sockets = new Set();
      this.subscribers.set(businessId, sockets);
    }
    sockets.add(socket);
    return () => {
      sockets.delete(socket);
      if (sockets.size === 0) this.subscribers.delete(businessId);
    };
  }

  publish(businessId: string, message: RealtimeServerMessage): void {
    const encoded = JSON.stringify(message);
    for (const socket of this.subscribers.get(businessId) ?? []) {
      try {
        socket.send(encoded);
      } catch {
        // A socket that cannot accept a frame is closing; its close handler unsubscribes it.
      }
    }
  }

  /** Answers a client heartbeat; anything else a client sends is ignored. */
  receive(socket: RealtimeSocket, raw: unknown): void {
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (realtimeClientMessageSchema.safeParse(parsed).success) {
      socket.send(JSON.stringify({ type: "pong" } satisfies RealtimeServerMessage));
    }
  }
}

function refusal(error: ApiError): Response {
  return Response.json(
    { error: { code: error.code, message: error.message } },
    { status: error.status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Admits a socket only for a signed-in member of the session's active business. A browser always
 * sends Origin on a WebSocket handshake, so a foreign Origin is refused to stop cross-site socket
 * hijacking with the session cookie.
 */
export async function authorizeRealtime(input: {
  auth: Auth;
  db: Database;
  corsOrigins: readonly string[];
  request: Request;
}): Promise<{ businessId: string } | Response> {
  const origin = input.request.headers.get("origin");
  if (origin !== null && !input.corsOrigins.includes(origin)) {
    return refusal(new ApiError(403, "FORBIDDEN", "Request origin is not allowed"));
  }
  try {
    const actor = toProductActor(await requireSession(input.auth, input.request.headers));
    const businessId = actor.activeBusinessId;
    if (!businessId) {
      throw new ApiError(409, "BUSINESS_REQUIRED", "Select or create a business before continuing");
    }
    const [membership] = await input.db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, businessId), eq(member.userId, actor.userId)))
      .limit(1);
    if (!membership)
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this business");
    return { businessId };
  } catch (error) {
    if (error instanceof ApiError) return refusal(error);
    throw error;
  }
}

export function isRealtimeUpgrade(request: Request): boolean {
  return (
    request.method === "GET" &&
    new URL(request.url).pathname === realtimePath &&
    request.headers.get("upgrade")?.toLowerCase() === "websocket"
  );
}
