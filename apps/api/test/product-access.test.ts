import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { ConsumeProductRequest } from "@pisto/db";
import { Hono } from "hono";
import { normalizeError } from "../src/errors.ts";
import { productAccess } from "../src/middleware/product-access.ts";
import type { AppEnv } from "../src/types.ts";

function createTestApp(
  options: {
    authenticated?: boolean;
    writesEnabled?: boolean;
    consume?: ConsumeProductRequest;
  } = {},
) {
  const app = new Hono<AppEnv>();
  const auth = {
    api: {
      getSession: async () =>
        options.authenticated === false
          ? null
          : {
              user: { id: "server-user" },
              session: { id: "server-session" },
            },
    },
  } as unknown as Auth;
  app.use(
    "/v1/*",
    productAccess({
      auth,
      writesEnabled: options.writesEnabled ?? true,
      consume: options.consume ?? (async () => ({ allowed: true, retryAfterSeconds: 60 })),
    }),
  );
  app.all("*", (context) => context.json({ reached: true }));
  app.onError((error, context) => {
    const { apiError } = normalizeError(error);
    return context.json({ error: { code: apiError.code } }, apiError.status);
  });
  return app;
}

describe("product traffic controls", () => {
  test("requires authentication before charging a budget", async () => {
    let called = false;
    const response = await createTestApp({
      authenticated: false,
      consume: async () => {
        called = true;
        return { allowed: true, retryAfterSeconds: 60 };
      },
    }).request("/v1/sales");
    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  test("pauses every product write but preserves reads and provider callbacks", async () => {
    const app = createTestApp({ writesEnabled: false });
    for (const route of [
      "businesses",
      "sales",
      "catalog/products",
      "inventory/movements",
      "cash/accounts",
      "expenses",
      "customers",
      "receivables",
      "receivable-payments/payment-id/reverse",
      "future-capability/action",
    ]) {
      for (const method of ["POST", "PATCH", "PUT", "DELETE"]) {
        const response = await app.request(`/v1/${route}`, { method });
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ error: { code: "WRITES_PAUSED" } });
      }
      expect((await app.request(`/v1/${route}`)).status).toBe(200);
    }
    expect((await app.request("/v1/webhooks/revenuecat", { method: "POST" })).status).toBe(200);
    expect((await app.request("/api/auth/sign-out", { method: "POST" })).status).toBe(200);
  });

  test("uses server identity, returns Retry-After, and never reaches the operation", async () => {
    let received: unknown;
    const response = await createTestApp({
      consume: async (input) => {
        received = input;
        return { allowed: false, retryAfterSeconds: 17 };
      },
    }).request("/v1/sales?userId=spoofed", { method: "POST" });
    expect(received).toEqual({ userId: "server-user", write: true });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("17");
    expect(await response.json()).toEqual({ error: { code: "RATE_LIMITED" } });
  });

  test("fails closed if the shared budget store fails", async () => {
    const response = await createTestApp({
      consume: async () => {
        throw new Error("Store unavailable");
      },
    }).request("/v1/reports/operating");
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: { code: "INTERNAL_ERROR" } });
  });
});
