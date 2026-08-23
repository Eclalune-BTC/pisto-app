import { describe, expect, spyOn, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import type {
  CashRepository,
  CatalogRepository,
  ReceivablesRepository,
  ReportsRepository,
} from "@pisto/db";
import { type DatabaseHandle, ProductError, type ProductRepository } from "@pisto/db";

import { createApp } from "../src/app.ts";

function unavailableRepository<T extends object>(name: string, onCall?: () => void): T {
  return new Proxy({} as T, {
    get: () => async () => {
      onCall?.();
      throw new Error(`${name} is not configured in this test`);
    },
  });
}

function testApp(
  options: {
    authenticated?: boolean;
    polarEnabled?: boolean;
    activeBusinessId?: string | null;
    product?: ProductRepository;
    onRepositoryCall?: () => void;
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
    (options.onRepositoryCall
      ? unavailableRepository<ProductRepository>("Product repository", options.onRepositoryCall)
      : ({
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
        } satisfies ProductRepository));

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
    cash: unavailableRepository<CashRepository>("Cash repository", options.onRepositoryCall),
    catalog: unavailableRepository<CatalogRepository>(
      "Catalog repository",
      options.onRepositoryCall,
    ),
    database,
    product,
    receivables: unavailableRepository<ReceivablesRepository>(
      "Receivables repository",
      options.onRepositoryCall,
    ),
    reports: unavailableRepository<ReportsRepository>(
      "Reports repository",
      options.onRepositoryCall,
    ),
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

  test("applies the unsafe-method gate to PATCH, not only POST", async () => {
    const app = testApp({ authenticated: true, polarEnabled: true });
    const productId = "11111111-1111-4111-8111-111111111111";

    const plainText = await app.request(`/v1/catalog/products/${productId}`, {
      method: "PATCH",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    const foreignOrigin = await app.request(`/v1/catalog/products/${productId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        origin: "https://untrusted.example.test",
      },
      body: "{}",
    });

    expect(plainText.status).toBe(415);
    expect(foreignOrigin.status).toBe(403);
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

  // One table in src/errors.ts replaced four hand-written route mappers. These
  // triples are the statuses those mappers produced, asserted through the whole
  // application rather than against the table itself.
  const productErrorContract = [
    { code: "BUSINESS_REQUIRED", status: 409 },
    { code: "CONFLICT", status: 409 },
    { code: "FORBIDDEN", status: 403 },
    { code: "IDEMPOTENCY_CONFLICT", status: 409 },
    { code: "NOT_FOUND", status: 404 },
    { code: "UNAUTHORIZED", status: 401 },
    { code: "VALIDATION_ERROR", status: 400 },
  ] as const;

  test("translates every domain failure code to its unchanged public status", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      for (const { code, status } of productErrorContract) {
        const response = await testApp({
          authenticated: true,
          product: {
            listBusinesses: async () => {
              throw new ProductError(code, `Domain rejected the request as ${code}`);
            },
          } as unknown as ProductRepository,
        }).request("/v1/businesses");

        expect(response.status).toBe(status);
        expect(await response.json()).toMatchObject({
          error: { code, message: `Domain rejected the request as ${code}` },
        });
      }
      // A translated domain failure is an expected outcome, not an unhandled
      // exception, so the boundary must not log it.
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test("keeps an unrecognized failure opaque at the same boundary", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const response = await testApp({
        authenticated: true,
        product: {
          listBusinesses: async () => {
            throw new TypeError("driver detail that must not reach the client");
          },
        } as unknown as ProductRepository,
      }).request("/v1/businesses");

      expect(response.status).toBe(500);
      expect(await response.json()).toMatchObject({
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
      });
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test("covers the business listing that previously had no error translation", async () => {
    const response = await testApp({
      authenticated: true,
      product: {
        listBusinesses: async () => {
          throw new ProductError("FORBIDDEN", "The membership is no longer valid");
        },
      } as unknown as ProductRepository,
    }).request("/v1/businesses");

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  // Session resolution moved into one requireActor call per handler. This
  // enumerates the mounted domain surface so a handler that ever loses that call
  // fails here instead of serving an anonymous request.
  const jsonBody = { "content-type": "application/json" };
  const recordId = "11111111-1111-4111-8111-111111111111";
  const protectedRoutes: ReadonlyArray<readonly [string, string]> = [
    ["GET", "/v1/businesses"],
    ["POST", "/v1/businesses"],
    ["POST", "/v1/sales"],
    ["GET", "/v1/sales/summary/previous-month"],
    ["POST", `/v1/sales/${recordId}/void`],
    ["POST", `/v1/sales/${recordId}/replace`],
    ["GET", `/v1/sales/${recordId}`],
    ["GET", "/v1/catalog/categories"],
    ["POST", "/v1/catalog/categories"],
    ["PATCH", `/v1/catalog/categories/${recordId}`],
    ["POST", `/v1/catalog/categories/${recordId}/archive`],
    ["GET", "/v1/catalog/products"],
    ["POST", "/v1/catalog/products"],
    ["GET", `/v1/catalog/products/${recordId}`],
    ["PATCH", `/v1/catalog/products/${recordId}`],
    ["POST", `/v1/catalog/products/${recordId}/archive`],
    ["GET", "/v1/inventory/stock"],
    ["GET", `/v1/inventory/products/${recordId}/movements`],
    ["POST", `/v1/inventory/products/${recordId}/movements`],
    ["POST", `/v1/inventory/movements/${recordId}/reverse`],
    ["GET", "/v1/cash/accounts"],
    ["POST", "/v1/cash/accounts"],
    ["POST", `/v1/cash/accounts/${recordId}/update`],
    ["POST", `/v1/cash/accounts/${recordId}/archive`],
    ["GET", `/v1/cash/accounts/${recordId}`],
    ["POST", "/v1/cash/adjustments"],
    ["POST", `/v1/cash/movements/${recordId}/reverse`],
    ["POST", "/v1/cash/transfers"],
    ["GET", "/v1/cash/movements"],
    ["GET", "/v1/expenses/summary"],
    ["GET", "/v1/expenses"],
    ["POST", "/v1/expenses"],
    ["POST", `/v1/expenses/${recordId}/void`],
    ["GET", `/v1/expenses/${recordId}`],
    ["GET", "/v1/customers"],
    ["POST", "/v1/customers"],
    ["GET", `/v1/customers/${recordId}`],
    ["POST", `/v1/customers/${recordId}/update`],
    ["POST", `/v1/customers/${recordId}/archive`],
    ["GET", "/v1/receivables/summary"],
    ["GET", "/v1/receivables"],
    ["POST", "/v1/receivables"],
    ["GET", `/v1/receivables/${recordId}`],
    ["POST", `/v1/receivables/${recordId}/void`],
    ["POST", `/v1/receivables/${recordId}/payments`],
    ["POST", `/v1/receivable-payments/${recordId}/reverse`],
    ["GET", "/v1/reports/operating?startLocalDate=2026-08-01&endLocalDate=2026-08-22"],
  ];

  test("resolves a session before every domain handler touches a repository", async () => {
    let repositoryCalls = 0;
    const app = testApp({ onRepositoryCall: () => (repositoryCalls += 1) });

    for (const [method, path] of protectedRoutes) {
      const response = await app.request(path, {
        method,
        ...(method === "GET" ? {} : { headers: jsonBody, body: "{}" }),
      });
      expect({ method, path, status: response.status }).toEqual({
        method,
        path,
        status: 401,
      });
    }

    expect(repositoryCalls).toBe(0);
  });

  test("mounts every operating capability behind authentication and permits PATCH preflight", async () => {
    const app = testApp();
    for (const path of [
      "/v1/catalog/products",
      "/v1/cash/accounts",
      "/v1/customers",
      "/v1/reports/operating?startLocalDate=2026-08-01&endLocalDate=2026-08-22",
    ]) {
      const response = await app.request(path);
      expect(response.status).toBe(401);
    }

    const preflight = await app.request("/v1/catalog/products/example", {
      method: "OPTIONS",
      headers: {
        Origin: "https://app.example.test",
        "Access-Control-Request-Method": "PATCH",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("PATCH");
  });
});
