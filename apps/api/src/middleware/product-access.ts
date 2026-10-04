import type { Auth } from "@pisto/auth";
import type { ConsumeProductRequest, ProductActor } from "@pisto/db";
import { Elysia } from "elysia";
import { ApiError } from "../errors.ts";
import { requireSession, toProductActor } from "../session.ts";

/**
 * Exact paths of the mounted `/v1` groups that own their own session policy. Taking them from the
 * mounted instances keeps the business policy fail-closed: any other `/v1/*` path, including a
 * future or unknown one, is authenticated and charged before its body is parsed.
 */
export function sessionPolicyPaths(
  ...groups: ReadonlyArray<{ routes: ReadonlyArray<{ path: string }> }>
) {
  const paths = new Set<string>();
  for (const { path } of groups.flatMap((group) => group.routes)) {
    // onRequest runs before routing, so exemptions can only match literal paths.
    if (/[:*]/.test(path)) throw new Error(`Session-policy route must be a static path: ${path}`);
    paths.add(path);
  }
  return paths;
}

export function productAccess(input: {
  auth: Auth;
  writesEnabled: boolean;
  consume: ConsumeProductRequest;
  sessionPolicyPaths: ReadonlySet<string>;
}) {
  return new Elysia({ name: "pisto.product-access" })
    .decorate("actor", null as ProductActor | null)
    .onRequest(async (context) => {
      if (context.request.method === "OPTIONS") return;
      const path = new URL(context.request.url).pathname;
      if (!path.startsWith("/v1/") || input.sessionPolicyPaths.has(path)) return;
      // Elysia's onRequest is global and the only hook before body parsing, so the business
      // policy is decided here. The actor lives in this request's context; repositories still
      // authorize in SQL.
      const session = await requireSession(input.auth, context.request.headers);
      context.actor = toProductActor(session);
      const write = !["GET", "HEAD"].includes(context.request.method);
      if (write && !input.writesEnabled) {
        throw new ApiError(503, "WRITES_PAUSED", "Business changes are temporarily paused");
      }
      const result = await input.consume({ userId: session.user.id, write });
      if (!result.allowed) {
        context.set.headers["Retry-After"] = String(result.retryAfterSeconds);
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "Too many requests; try again after the indicated delay",
        );
      }
    })
    .as("global");
}

export type ProductAccess = ReturnType<typeof productAccess>;
