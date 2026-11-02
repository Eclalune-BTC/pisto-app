import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { Database } from "@pisto/db";

import {
  authorizeRealtime,
  changedResource,
  isRealtimeUpgrade,
  RealtimeHub,
  type RealtimeSocket,
} from "../src/realtime.ts";

const businessId = "6f9c2a4e-8d1b-4c3a-9e5f-1a2b3c4d5e6f";

function socket() {
  const sent: string[] = [];
  return { sent, send: (message: string) => sent.push(message), close: () => undefined };
}

function authWith(session: { activeOrganizationId: string | null } | null): Auth {
  return {
    api: {
      getSession: async () =>
        session && {
          user: { id: "user_test", name: "Test", email: "user@example.test" },
          session: { id: "session_test", activeOrganizationId: session.activeOrganizationId },
        },
    },
  } as unknown as Auth;
}

/** A query builder whose final `limit` resolves to the given membership rows. */
function dbWith(rows: { id: string }[]): Database {
  const chain = { from: () => chain, where: () => chain, limit: async () => rows };
  return { select: () => chain } as unknown as Database;
}

function handshake(origin?: string) {
  return new Request("https://api.example.test/v1/realtime", {
    headers: { upgrade: "websocket", ...(origin ? { origin } : {}) },
  });
}

describe("realtime hub", () => {
  test("delivers a notice only to the sockets of its business until they unsubscribe", () => {
    const hub = new RealtimeHub();
    const member = socket();
    const otherBusiness = socket();
    const unsubscribe = hub.subscribe(businessId, member);
    hub.subscribe("other-business", otherBusiness);

    const notice = {
      type: "business.changed" as const,
      businessId,
      resource: "sales" as const,
      at: "2026-11-01T12:00:00.000Z",
    };
    hub.publish(businessId, notice);
    unsubscribe();
    hub.publish(businessId, notice);

    expect(member.sent).toEqual([JSON.stringify(notice)]);
    expect(otherBusiness.sent).toEqual([]);
  });

  test("keeps delivering when one socket throws", () => {
    const hub = new RealtimeHub();
    const broken: RealtimeSocket = {
      send: () => {
        throw new Error("closing");
      },
      close: () => undefined,
    };
    const healthy = socket();
    hub.subscribe(businessId, broken);
    hub.subscribe(businessId, healthy);

    hub.publish(businessId, { type: "pong" });

    expect(healthy.sent).toEqual([JSON.stringify({ type: "pong" })]);
  });

  test("answers a heartbeat and ignores anything else a client sends", () => {
    const hub = new RealtimeHub();
    const client = socket();

    for (const raw of ['{"type":"ping"}', '{"type":"ping","extra":1}', "not json", null, "{}"]) {
      hub.receive(client, raw);
    }

    expect(client.sent).toEqual([JSON.stringify({ type: "pong" })]);
  });
});

describe("realtime routing", () => {
  test("maps business write paths to the area they change and ignores everything else", () => {
    expect(changedResource("/v1/sales")).toBe("sales");
    expect(changedResource("/v1/sales/abc/void")).toBe("sales");
    expect(changedResource("/v1/receivable-payments/abc/reverse")).toBe("receivables");
    expect(changedResource("/v1/inventory/products/abc/movements")).toBe("inventory");
    expect(changedResource("/v1/suppliers/abc/archive")).toBe("purchases");
    expect(changedResource("/v1/purchases")).toBe("purchases");
    expect(changedResource("/v1/purchases/abc/payments")).toBe("purchases");
    expect(changedResource("/v1/payables/summary")).toBe("purchases");
    expect(changedResource("/v1/purchasesx")).toBeNull();
    expect(changedResource("/v1/salesman")).toBeNull();
    expect(changedResource("/v1/businesses/members")).toBe("members");
    expect(changedResource("/v1/businesses/members/abc/remove")).toBe("members");
    expect(changedResource("/v1/businesses")).toBeNull();
    expect(changedResource("/api/auth/sign-in/email")).toBeNull();
  });

  test("recognizes only a GET WebSocket handshake on the realtime path", () => {
    expect(isRealtimeUpgrade(handshake())).toBe(true);
    expect(isRealtimeUpgrade(new Request("https://api.example.test/v1/realtime"))).toBe(false);
    expect(
      isRealtimeUpgrade(
        new Request("https://api.example.test/v1/sales", { headers: { upgrade: "websocket" } }),
      ),
    ).toBe(false);
  });
});

describe("realtime admission", () => {
  const corsOrigins = ["https://app.example.test"];

  test("admits a member of the active business", async () => {
    const admission = await authorizeRealtime({
      auth: authWith({ activeOrganizationId: businessId }),
      db: dbWith([{ id: "member_test" }]),
      corsOrigins,
      request: handshake("https://app.example.test"),
    });

    expect(admission).toEqual({ businessId });
  });

  test("refuses a foreign origin, no session, no business and a non-member", async () => {
    const cases = [
      {
        origin: "https://attacker.example",
        session: { activeOrganizationId: businessId },
        rows: [{ id: "m" }],
        status: 403,
      },
      { origin: undefined, session: null, rows: [{ id: "m" }], status: 401 },
      {
        origin: undefined,
        session: { activeOrganizationId: null },
        rows: [{ id: "m" }],
        status: 409,
      },
      { origin: undefined, session: { activeOrganizationId: businessId }, rows: [], status: 403 },
    ];
    for (const { origin, session, rows, status } of cases) {
      const admission = await authorizeRealtime({
        auth: authWith(session),
        db: dbWith(rows),
        corsOrigins,
        request: handshake(origin),
      });
      expect(admission).toBeInstanceOf(Response);
      expect((admission as Response).status).toBe(status);
    }
  });
});
