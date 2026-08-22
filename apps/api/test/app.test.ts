import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import type { DatabaseHandle } from "@pisto/db";

import { createApp } from "../src/app.ts";

function testApp(options: { authenticated?: boolean; polarEnabled?: boolean } = {}) {
  const auth = {
    handler: async (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/api/auth/customer/portal") {
        return Response.json({
          url: "https://polar.example.test/customer-portal",
          redirect: true,
        });
      }
      if (path.startsWith("/api/auth/checkout") || path.startsWith("/api/auth/customer")) {
        return Response.json({ adapterRouteReached: true });
      }
      if (path === "/api/auth/polar/webhooks") {
        return Response.json({ adapterRouteReached: true }, { status: 202 });
      }
      return new Response(null, { status: 404 });
    },
    api: {
      getSession: async () =>
        options.authenticated
          ? {
              user: {
                id: "user_test",
                name: "Test User",
                email: "user@example.test",
                emailVerified: true,
                image: null,
              },
              session: {
                id: "session_test",
                expiresAt: new Date(Date.now() + 60_000),
                activeOrganizationId: null,
              },
            }
          : null,
    },
  } as unknown as Auth;
  const billing = {
    config: {
      polar: { enabled: options.polarEnabled ?? false },
      revenueCat: { enabled: false },
    },
    catalog: [],
    listEntitlements: async () => [],
    processRevenueCatWebhook: async () => {
      throw new Error("RevenueCat is disabled");
    },
    polar: { client: null, plugin: null, processWebhook: null },
  } as unknown as BillingRuntime;
  const database = {
    db: {},
    client: {},
    ping: async () => undefined,
    close: async () => undefined,
  } as unknown as DatabaseHandle;

  return createApp({
    config: {
      host: "127.0.0.1",
      port: 3001,
      corsOrigins: ["https://app.example.test"],
      requestBodyLimitBytes: 1_048_576,
      production: false,
    },
    authConfig: { baseUrl: "https://api.example.test" },
    auth,
    billing,
    database,
  });
}

describe("Pisto API", () => {
  test("returns liveness without touching the database", async () => {
    const response = await testApp().request("/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      status: "ok",
      service: "pisto-api",
    });
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  test("reports disabled billing explicitly", async () => {
    const response = await testApp().request("/v1/billing/catalog");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { status: "disabled", provider: null, products: [] },
    });
  });

  test("protects the current-user route", async () => {
    const response = await testApp().request("/v1/me");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
  });

  test("does not reflect an invalid incoming request ID", async () => {
    const response = await testApp().request("/missing", {
      headers: { "x-request-id": "invalid id with spaces" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).not.toBe("invalid id with spaces");
  });

  test("accepts an empty body for the customer portal request", async () => {
    const response = await testApp({
      authenticated: true,
      polarEnabled: true,
    }).request("/v1/billing/portal", { method: "POST" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        url: "https://polar.example.test/customer-portal",
        redirect: false,
      },
    });
  });

  test("does not expose provider billing routes through the auth catch-all", async () => {
    const app = testApp({ authenticated: true, polarEnabled: true });
    // The fake handler deliberately returns 200 for every guarded provider
    // path. A 404 therefore proves that Hono stopped the request at the edge.
    const checkout = await app.request("/api/auth/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ products: "unlisted_product", referenceId: "another_org" }),
    });
    const checkoutSubpath = await app.request("/api/auth/checkout/", { method: "POST" });
    const subscriptions = await app.request(
      "/api/auth/customer/subscriptions/list?referenceId=another_org",
    );

    expect(checkout.status).toBe(404);
    expect(checkoutSubpath.status).toBe(404);
    expect(subscriptions.status).toBe(404);
    expect(await checkout.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
    expect(await subscriptions.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  test("keeps the Polar webhook path on the Better Auth handler", async () => {
    const response = await testApp({ polarEnabled: true }).request("/api/auth/polar/webhooks", {
      method: "POST",
      body: "{}",
    });

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ adapterRouteReached: true });
  });
});
