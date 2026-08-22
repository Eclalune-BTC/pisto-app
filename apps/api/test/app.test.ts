import { describe, expect, spyOn, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import { type DatabaseHandle, ProductError, type ProductRepository } from "@pisto/db";

import { createApp } from "../src/app.ts";

function testApp(
  options: {
    authenticated?: boolean;
    polarEnabled?: boolean;
    activeBusinessId?: string | null;
    product?: ProductRepository;
  } = {},
) {
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
      if (path === "/api/auth/organization/set-active") {
        return Response.json({ organizationSelectorReached: true });
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
                activeOrganizationId: options.activeBusinessId ?? null,
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
  const product =
    options.product ??
    ({
      listBusinesses: async () => ({ activeBusinessId: null, items: [] }),
      createBusiness: async () => {
        throw new ProductError("CONFLICT", "Not configured in this test");
      },
      createSale: async () => {
        throw new ProductError("BUSINESS_REQUIRED", "Create a business first");
      },
      voidSale: async () => {
        throw new ProductError("NOT_FOUND", "Sale was not found");
      },
      replaceSale: async () => {
        throw new ProductError("NOT_FOUND", "Sale was not found");
      },
      getSale: async () => {
        throw new ProductError("NOT_FOUND", "Sale was not found");
      },
      getPreviousMonthSummary: async () => {
        throw new ProductError("BUSINESS_REQUIRED", "Create a business first");
      },
    } satisfies ProductRepository);

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
    product,
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

  test("marks account and product responses as non-cacheable", async () => {
    const response = await testApp({ authenticated: true }).request("/v1/me");

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("does not reflect an invalid incoming request ID", async () => {
    const response = await testApp().request("/missing", {
      headers: { "x-request-id": "invalid id with spaces" },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).not.toBe("invalid id with spaces");
  });

  test("does not write unexpected error messages into request logs", async () => {
    const sensitiveText = "private-business-description-should-not-be-logged";
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await testApp({
        authenticated: true,
        product: {
          listBusinesses: async () => {
            throw new Error(sensitiveText);
          },
        } as unknown as ProductRepository,
      }).request("/v1/businesses");

      expect(response.status).toBe(500);
      const output = consoleError.mock.calls.flat().join(" ");
      expect(output).not.toContain(sensitiveText);
      expect(output).toContain("Unhandled request error");
    } finally {
      consoleError.mockRestore();
    }
  });

  test("accepts an empty body for the customer portal request", async () => {
    const response = await testApp({
      authenticated: true,
      polarEnabled: true,
    }).request("/v1/billing/portal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });

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

  test("blocks raw organization mutations while preserving the active selector", async () => {
    const app = testApp({ authenticated: true });
    const create = await app.request("/api/auth/organization/create", { method: "POST" });
    const removeMember = await app.request("/api/auth/organization/remove-member", {
      method: "POST",
    });
    const selector = await app.request("/api/auth/organization/set-active", { method: "POST" });

    expect(create.status).toBe(404);
    expect(removeMember.status).toBe(404);
    expect(selector.status).toBe(200);
    expect(await selector.json()).toEqual({ organizationSelectorReached: true });
  });

  test("protects product routes and never accepts a client business identifier", async () => {
    const anonymous = await testApp().request("/v1/businesses");
    expect(anonymous.status).toBe(401);

    const response = await testApp({ authenticated: true }).request("/v1/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "85d434e5-a7fd-49b7-9f12-38aa80a920ae",
        grossMinorUnits: "1250",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "14:30",
        businessId: "another-business",
      }),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("rejects unsafe product requests before they reach the repository", async () => {
    let repositoryCalled = false;
    const product = {
      createSale: async () => {
        repositoryCalled = true;
        throw new Error("Repository should not be called");
      },
    } as unknown as ProductRepository;
    const app = testApp({ authenticated: true, product });

    const plainText = await app.request("/v1/sales", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    const foreignOrigin = await app.request("/v1/sales", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://untrusted.example.test",
      },
      body: "{}",
    });

    expect(plainText.status).toBe(415);
    expect(foreignOrigin.status).toBe(403);
    expect(repositoryCalled).toBe(false);
  });

  test("uses one explicit malformed-JSON failure contract across API routes", async () => {
    const app = testApp({ authenticated: true, polarEnabled: true });
    const sale = await app.request("/v1/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const checkout = await app.request("/v1/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });

    expect(sale.status).toBe(400);
    expect(checkout.status).toBe(400);
    expect(await sale.json()).toMatchObject({ error: { code: "BAD_REQUEST" } });
    expect(await checkout.json()).toMatchObject({ error: { code: "BAD_REQUEST" } });
  });

  test("keeps missing business state distinct from an empty summary", async () => {
    const response = await testApp({ authenticated: true }).request(
      "/v1/sales/summary/previous-month",
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "BUSINESS_REQUIRED" } });
  });

  test("validates sale corrections before dispatching them", async () => {
    let repositoryCalled = false;
    const product = {
      voidSale: async () => {
        repositoryCalled = true;
        throw new Error("Repository should not be called");
      },
      replaceSale: async () => {
        repositoryCalled = true;
        throw new Error("Repository should not be called");
      },
    } as unknown as ProductRepository;
    const app = testApp({ authenticated: true, product });
    const saleId = "5312a3e6-7c91-486a-9233-0cf4d9d3dcc7";

    const invalidVoid = await app.request(`/v1/sales/${saleId}/void`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), reason: " " }),
    });
    const invalidReplacement = await app.request(`/v1/sales/${saleId}/replace`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        reason: "Correct amount",
        replacement: {
          grossMinorUnits: "12.50",
          occurredLocalDate: "2026-08-22",
          occurredLocalTime: "14:30",
        },
      }),
    });

    expect(invalidVoid.status).toBe(400);
    expect(invalidReplacement.status).toBe(400);
    expect(repositoryCalled).toBe(false);
  });
});
