import { describe, expect, spyOn, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import { BillingProviderError, type BillingRuntime, RevenueCatWebhookError } from "@pisto/billing";
import type {
  CashRepository,
  CatalogRepository,
  DebtorsRepository,
  MoneyTrendRepository,
  MovementsRepository,
  ReceivablesRepository,
  ReportsRepository,
} from "@pisto/db";
import {
  type BusinessRepository,
  type DatabaseHandle,
  ProductError,
  type SalesRepository,
} from "@pisto/db";
import { createApp } from "../src/app.ts";
import { sessionPolicyPaths } from "../src/middleware/product-access.ts";
import { RealtimeHub } from "../src/realtime.ts";
import { testClient } from "./http-client.ts";

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
    businesses?: BusinessRepository;
    sales?: SalesRepository;
    onRepositoryCall?: () => void;
    readCustomerState?: BillingRuntime["readCustomerState"];
    onSessionRead?: () => void;
    sessionFailure?: Error;
    authHandler?: Auth["handler"];
    processRevenueCatWebhook?: BillingRuntime["processRevenueCatWebhook"];
    requestBodyLimitBytes?: number;
    db?: DatabaseHandle["db"];
    onConsume?: () => void;
    ping?: DatabaseHandle["ping"];
    realtime?: RealtimeHub;
  } = {},
) {
  const auth = {
    handler:
      options.authHandler ??
      (async (request: Request) => {
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
      }),
    api: {
      getSession: async () => {
        options.onSessionRead?.();
        if (options.sessionFailure) throw options.sessionFailure;
        return options.authenticated
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
          : null;
      },
    },
  } as unknown as Auth;
  const billing = {
    checkoutEnabled: options.polarEnabled ?? false,
    revenueCatEnabled: false,
    hasProduct: (slug: string) => slug === "pro",
    catalog: [],
    listEntitlements: async () => [],
    readCustomerState: options.readCustomerState ?? (async () => ({ activeSubscriptions: [] })),
    processRevenueCatWebhook:
      options.processRevenueCatWebhook ??
      (async () => {
        throw new Error("RevenueCat is disabled");
      }),
    authPlugin: null,
  } as unknown as BillingRuntime;
  const database = {
    db: options.db ?? {},
    client: {},
    ping: options.ping ?? (async () => undefined),
    close: async () => undefined,
  } as unknown as DatabaseHandle;
  const businesses =
    options.businesses ??
    (options.onRepositoryCall
      ? unavailableRepository<BusinessRepository>("Business repository", options.onRepositoryCall)
      : ({
          listBusinesses: async () => ({ activeBusinessId: null, items: [] }),
          createBusiness: async () => {
            throw new ProductError("CONFLICT", "Not configured in this test");
          },
        } satisfies BusinessRepository));
  const sales =
    options.sales ??
    (options.onRepositoryCall
      ? unavailableRepository<SalesRepository>("Sales repository", options.onRepositoryCall)
      : ({
          createSale: async () => {
            throw new ProductError("BUSINESS_REQUIRED", "Create a business first");
          },
          getSaleReview: async () => null,
          prepareSaleReview: async () => {
            throw new ProductError("BUSINESS_REQUIRED", "Create a business first");
          },
          confirmSaleReview: async () => {
            throw new ProductError("NOT_FOUND", "Sale review was not found");
          },
          dismissSaleReview: async () => {
            throw new ProductError("NOT_FOUND", "Sale review was not found");
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
          listSales: async () => {
            throw new ProductError("BUSINESS_REQUIRED", "Create a business first");
          },
          getPreviousMonthSummary: async () => {
            throw new ProductError("BUSINESS_REQUIRED", "Create a business first");
          },
        } satisfies SalesRepository));

  return testClient(
    createApp({
      config: {
        host: "127.0.0.1",
        port: 3001,
        corsOrigins: ["https://app.example.test"],
        requestBodyLimitBytes: options.requestBodyLimitBytes ?? 1_048_576,
        production: false,
        productWritesEnabled: true,
        productReadLimit: 300,
        productWriteLimit: 60,
      },
      authBaseUrl: "https://api.example.test",
      auth,
      realtime: options.realtime ?? new RealtimeHub(),
      consumeProductRequest: async () => {
        options.onConsume?.();
        return { allowed: true, retryAfterSeconds: 60 };
      },
      billing,
      database,
      repositories: {
        businesses,
        cash: unavailableRepository<CashRepository>("Cash repository", options.onRepositoryCall),
        catalog: unavailableRepository<CatalogRepository>(
          "Catalog repository",
          options.onRepositoryCall,
        ),
        debtors: unavailableRepository<DebtorsRepository>(
          "Debtors repository",
          options.onRepositoryCall,
        ),
        moneyTrend: unavailableRepository<MoneyTrendRepository>(
          "Money trend repository",
          options.onRepositoryCall,
        ),
        movements: unavailableRepository<MovementsRepository>(
          "Movements repository",
          options.onRepositoryCall,
        ),
        receivables: unavailableRepository<ReceivablesRepository>(
          "Receivables repository",
          options.onRepositoryCall,
        ),
        reports: unavailableRepository<ReportsRepository>(
          "Reports repository",
          options.onRepositoryCall,
        ),
        sales,
      },
    }),
  );
}

describe("HTTP framework compatibility", () => {
  test("resolves a fresh actor once per request, including HEAD", async () => {
    let sessions = 0;
    const app = testApp({ authenticated: true, onSessionRead: () => sessions++ });
    expect((await app.request("/v1/businesses")).status).toBe(200);
    const head = await app.request("/v1/businesses", { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    expect(sessions).toBe(2);
    const denied = await testApp().request("/v1/businesses", { method: "HEAD" });
    expect(denied.status).toBe(401);
    expect(await denied.text()).toBe("");
  });

  test("preserves auth, identifier, JSON and contract failure precedence", async () => {
    const headers = { "content-type": "application/json" };
    const anonymous = await testApp().request("/v1/sales", { method: "POST", headers, body: "{" });
    expect(anonymous.status).toBe(401);
    const app = testApp({ authenticated: true });
    const hidden = await app.request("/v1/sales/not-a-uuid/void", {
      method: "POST",
      headers,
      body: "{",
    });
    expect(hidden.status).toBe(404);
    for (const body of [undefined, "", "{"]) {
      const response = await app.request("/v1/sales", { method: "POST", headers, body });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        error: { code: "BAD_REQUEST", message: "Request body must be valid JSON" },
      });
    }
    const invalid = await app.request("/v1/sales", {
      method: "POST",
      headers,
      body: '{"amountMinorUnits":"private-invalid-value"}',
    });
    expect(invalid.status).toBe(400);
    const payload = await invalid.json();
    expect(payload).toMatchObject({
      error: {
        code: "VALIDATION_ERROR",
        message: "Sale confirmation is invalid",
        details: { fieldErrors: expect.any(Object) },
      },
    });
    expect(JSON.stringify(payload)).not.toContain("private-invalid-value");
  });

  test("hides malformed identifiers on reads without reaching a repository", async () => {
    let repositoryCalls = 0;
    const app = testApp({ authenticated: true, onRepositoryCall: () => repositoryCalls++ });
    for (const method of ["GET", "HEAD"]) {
      const response = await app.request("/v1/sales/not-a-uuid", { method });
      expect(response.status).toBe(404);
    }
    expect(repositoryCalls).toBe(0);
  });

  test("bounds streams without Content-Length and retains security headers on errors", async () => {
    let authCalls = 0;
    const app = testApp({
      requestBodyLimitBytes: 8,
      authHandler: async () => {
        authCalls++;
        return new Response(null, { status: 202 });
      },
    });
    for (const [size, expected] of [
      [8, 202],
      [9, 413],
    ] as const) {
      const response = await app.request("/api/auth/polar/webhooks", {
        method: "POST",
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(size));
            controller.close();
          },
        }),
      });
      expect(response.status).toBe(expected);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-request-id")).toBeTruthy();
    }
    expect(authCalls).toBe(1);
  });

  test("preserves raw provider bodies, multiple cookies and response policy", async () => {
    const raw = ' { "event": "raw", "text": "café" }\n';
    let webhookInput: unknown;
    const app = testApp({
      authHandler: async (request) => {
        expect(await request.text()).toBe(raw);
        const headers = new Headers({ "x-frame-options": "ALLOWALL", "x-powered-by": "provider" });
        headers.append("set-cookie", "first=1; HttpOnly; Path=/");
        headers.append("set-cookie", "second=2; HttpOnly; Path=/");
        return new Response(null, { status: 202, headers });
      },
      processRevenueCatWebhook: async (input) => {
        webhookInput = input;
        return { duplicate: false, projected: false };
      },
    });
    const headers = {
      "content-type": "application/json",
      authorization: "Bearer fixture",
      "x-revenuecat-webhook-signature": "fixture-signature",
    };
    const auth = await app.request("/api/auth/polar/webhooks", {
      method: "POST",
      headers,
      body: raw,
    });
    expect(auth.status).toBe(202);
    expect(auth.headers.getSetCookie()).toEqual([
      "first=1; HttpOnly; Path=/",
      "second=2; HttpOnly; Path=/",
    ]);
    expect(auth.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(auth.headers.has("x-powered-by")).toBe(false);
    const webhook = await app.request("/v1/webhooks/revenuecat", {
      method: "POST",
      headers,
      body: raw,
    });
    expect(webhook.status).toBe(200);
    expect(webhookInput).toEqual({
      authorization: "Bearer fixture",
      signature: "fixture-signature",
      rawBody: raw,
    });
  });

  test("keeps strict paths and logs preflight without requiring a session", async () => {
    let sessions = 0;
    const app = testApp({ authenticated: true, onSessionRead: () => sessions++ });
    expect((await app.request("/health/")).status).toBe(404);
    expect((await app.request("/v1")).status).toBe(200);
    expect((await app.request("/v1/")).status).toBe(200);
    await new Promise<void>((resolve) => setImmediate(resolve));
    const output = spyOn(console, "info").mockImplementation(() => undefined);
    try {
      const response = await app.request("/v1/private-record", {
        method: "OPTIONS",
        headers: { origin: "https://app.example.test", "access-control-request-method": "PATCH" },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("https://app.example.test");
      expect(response.headers.get("access-control-max-age")).toBe("600");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(sessions).toBe(0);
      await new Promise<void>((resolve) => setImmediate(resolve));
      const logs = output.mock.calls.map(([value]) => JSON.parse(String(value)));
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ method: "OPTIONS", status: 204, path: "/*" });
      expect(JSON.stringify(logs)).not.toContain("private-record");
    } finally {
      output.mockRestore();
    }
  });
});

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

  test("reports a failed session lookup as a retryable outage without its cause", async () => {
    const app = testApp({ sessionFailure: new Error("pool exhausted: password=secret") });
    for (const path of ["/v1/me", "/v1/sales"]) {
      const response = await app.request(path);
      expect(response.status).toBe(503);
      const body = await response.text();
      expect(JSON.parse(body)).toMatchObject({ error: { code: "SERVICE_UNAVAILABLE" } });
      expect(body).not.toContain("pool exhausted");
    }
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
        businesses: {
          listBusinesses: async () => {
            throw new Error(sensitiveText);
          },
        } as unknown as BusinessRepository,
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

  test("reads billing state through the scope-bound provider adapter", async () => {
    let scope: unknown;
    const response = await testApp({
      authenticated: true,
      polarEnabled: true,
      readCustomerState: async (selectedScope) => {
        scope = selectedScope;
        return { activeSubscriptions: [] };
      },
    }).request("/v1/billing/state");
    expect(response.status).toBe(200);
    expect(scope).toEqual({ type: "user", id: "user_test" });
    expect(await response.json()).toMatchObject({
      data: { customerState: { activeSubscriptions: [] } },
    });
  });

  test("passes only the authorized organization using the migrated checkout field", async () => {
    for (const membership of [true, false]) {
      const forwarded: unknown[] = [];
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: async () => (membership ? [{ id: "membership" }] : []),
            }),
          }),
        }),
      } as unknown as DatabaseHandle["db"];
      const app = testApp({
        authenticated: true,
        polarEnabled: true,
        activeBusinessId: "authorized-business",
        db,
        authHandler: async (request) => {
          forwarded.push(await request.json());
          return Response.json({ url: "https://checkout.example.test/session", redirect: false });
        },
      });
      const response = await app.request("/v1/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "pro" }),
      });
      expect(response.status).toBe(membership ? 200 : 403);
      expect(forwarded).toEqual(
        membership ? [{ slug: "pro", reference_id: "authorized-business", redirect: false }] : [],
      );
      const forged = await app.request("/v1/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug: "pro", reference_id: "forged-business" }),
      });
      expect(forged.status).toBe(membership ? 400 : 403);
      expect(forwarded).toHaveLength(membership ? 1 : 0);
    }
  });

  test("checks the session, then the contract, then the billing switch", async () => {
    const post = (app: ReturnType<typeof testApp>, path: string, body: string) =>
      app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body });
    const valid = JSON.stringify({ slug: "pro" });
    expect(
      (await post(testApp({ polarEnabled: true }), "/v1/billing/checkout", valid)).status,
    ).toBe(401);
    expect((await post(testApp(), "/v1/billing/portal", "{}")).status).toBe(401);
    const disabled = testApp({ authenticated: true });
    const invalid = await post(disabled, "/v1/billing/checkout", JSON.stringify({ slug: 1 }));
    expect(invalid.status).toBe(400);
    for (const [path, body] of [
      ["/v1/billing/checkout", valid],
      ["/v1/billing/portal", "{}"],
    ] as const) {
      const response = await post(disabled, path, body);
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ error: { code: "BILLING_DISABLED" } });
    }
  });

  test("returns a stable unavailable error for billing-state provider failures", async () => {
    const response = await testApp({
      authenticated: true,
      polarEnabled: true,
      readCustomerState: async () => {
        throw new BillingProviderError();
      },
    }).request("/v1/billing/state");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: "BILLING_UNAVAILABLE" } });
  });

  test("does not expose provider billing routes through the auth catch-all", async () => {
    const app = testApp({ authenticated: true, polarEnabled: true });
    // The fake handler deliberately returns 200 for every guarded provider
    // path. A 404 therefore proves that the API stopped the request at the edge.
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
    const sales = {
      createSale: async () => {
        repositoryCalled = true;
        throw new Error("Repository should not be called");
      },
    } as unknown as SalesRepository;
    const app = testApp({ authenticated: true, sales });

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

  test("accepts exact JSON media types with parameters and rejects lookalikes before commands", async () => {
    let commands = 0;
    const app = testApp({
      authenticated: true,
      businesses: {
        createBusiness: async () => {
          commands += 1;
          return { replayed: false };
        },
      } as unknown as BusinessRepository,
    });
    const body = JSON.stringify({
      name: "Test Store",
      currency: "USD",
      timeZone: "America/El_Salvador",
    });
    for (const contentType of [
      "application/jsonp",
      "application/json-malformed",
      "application/json, text/plain",
    ]) {
      const response = await app.request("/v1/businesses", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      });
      expect(response.status).toBe(415);
    }
    expect(commands).toBe(0);
    for (const contentType of [
      "application/json",
      "Application/JSON; charset=utf-8",
      "application/json ; charset=UTF-8",
    ]) {
      const response = await app.request("/v1/businesses", {
        method: "POST",
        headers: { "content-type": contentType },
        body,
      });
      expect(response.status).toBe(201);
    }
    expect(commands).toBe(3);
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
    const sales = {
      voidSale: async () => {
        repositoryCalled = true;
        throw new Error("Repository should not be called");
      },
      replaceSale: async () => {
        repositoryCalled = true;
        throw new Error("Repository should not be called");
      },
    } as unknown as SalesRepository;
    const app = testApp({ authenticated: true, sales });
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

  test("preserves command envelopes and security headers for creation and replay", async () => {
    for (const replayed of [false, true]) {
      const result = { business: { id: "business-test" }, replayed };
      const response = await testApp({
        authenticated: true,
        businesses: { createBusiness: async () => result } as unknown as BusinessRepository,
      }).request("/v1/businesses", {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "command-test" },
        body: JSON.stringify({
          name: "Test Store",
          currency: "USD",
          timeZone: "America/El_Salvador",
        }),
      });

      expect(response.status).toBe(replayed ? 200 : 201);
      expect(await response.json()).toEqual({ data: result });
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-request-id")).toBe("command-test");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });

  test("announces a committed write to the active business and stays silent on failure", async () => {
    const businessId = "6f9c2a4e-8d1b-4c3a-9e5f-1a2b3c4d5e6f";
    const command = {
      idempotencyKey: "0b7c2d1e-3f4a-4b5c-8d6e-7f8a9b0c1d2e",
      grossMinorUnits: "1250",
      occurredLocalDate: "2026-11-01",
      occurredLocalTime: "09:30",
    };
    const published: unknown[] = [];
    const realtime = new RealtimeHub();
    realtime.publish = (target, message) => {
      published.push({ target, message });
    };
    let fail = false;
    const sales = {
      createSale: async () => {
        if (fail) throw new ProductError("IDEMPOTENCY_CONFLICT", "Key already used");
        return { sale: { id: "sale-test" }, replayed: false };
      },
    } as unknown as SalesRepository;
    const app = testApp({ authenticated: true, activeBusinessId: businessId, sales, realtime });
    const post = () =>
      app.request("/v1/sales", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(command),
      });

    expect((await post()).status).toBe(201);
    expect(published).toEqual([
      {
        target: businessId,
        message: {
          type: "business.changed",
          businessId,
          resource: "sales",
          at: expect.any(String),
        },
      },
    ]);

    fail = true;
    expect((await post()).status).toBe(409);
    expect(published).toHaveLength(1);
  });

  test("translates every domain failure code to its unchanged public status", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      for (const { code, status } of productErrorContract) {
        const response = await testApp({
          authenticated: true,
          businesses: {
            listBusinesses: async () => {
              throw new ProductError(code, `Domain rejected the request as ${code}`);
            },
          } as unknown as BusinessRepository,
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
        businesses: {
          listBusinesses: async () => {
            throw new TypeError("driver detail that must not reach the client");
          },
        } as unknown as BusinessRepository,
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

  test("keeps unknown failure keys opaque, including object prototype names", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const failures = ["FUTURE_FAILURE", "constructor", "toString", "__proto__"].flatMap((key) => [
        new ProductError(key as never, "Private domain detail"),
        new RevenueCatWebhookError(
          key as never,
          "REVENUECAT_INVALID_PAYLOAD",
          "Private domain detail",
        ),
      ]);
      for (const failure of failures) {
        const response = await testApp({
          authenticated: true,
          businesses: {
            listBusinesses: async () => {
              throw failure;
            },
          } as unknown as BusinessRepository,
        }).request("/v1/businesses");

        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({
          error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
        });
      }
      expect(consoleError).toHaveBeenCalledTimes(failures.length);
      expect(JSON.stringify(consoleError.mock.calls)).not.toContain("Private domain detail");
    } finally {
      consoleError.mockRestore();
    }
  });

  test("covers the business listing that previously had no error translation", async () => {
    const response = await testApp({
      authenticated: true,
      businesses: {
        listBusinesses: async () => {
          throw new ProductError("FORBIDDEN", "The membership is no longer valid");
        },
      } as unknown as BusinessRepository,
    }).request("/v1/businesses");

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: "FORBIDDEN" } });
  });

  // Enumerate the mounted domain surface so a route that loses its shared
  // session policy fails here instead of serving an anonymous request.
  const jsonBody = { "content-type": "application/json" };
  const recordId = "11111111-1111-4111-8111-111111111111";
  const protectedRoutes: ReadonlyArray<readonly [string, string]> = [
    ["GET", "/v1/businesses"],
    ["POST", "/v1/businesses"],
    ["GET", "/v1/sales"],
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

describe("route policy scoping", () => {
  const streamedBody = (size: number, onRead: () => void) =>
    new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          onRead();
          controller.enqueue(new Uint8Array(size));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );

  test("charges the request budget only for business routes, failing closed for unknown paths", async () => {
    let consumed = 0;
    const app = testApp({ authenticated: true, onConsume: () => consumed++ });
    for (const path of [
      "/v1",
      "/v1/",
      "/v1/me",
      "/v1/billing/catalog",
      "/v1/billing/entitlements",
      "/v1/billing/state",
    ]) {
      expect({ path, status: (await app.request(path)).status }).toEqual({ path, status: 200 });
    }
    expect(consumed).toBe(0);

    expect((await app.request("/v1/businesses")).status).toBe(200);
    expect(consumed).toBe(1);
    expect((await app.request("/v1/future-capability")).status).toBe(404);
    expect(consumed).toBe(2);
    expect((await testApp().request("/v1/future-capability")).status).toBe(401);
    expect((await testApp().request("/v1/billing/unknown")).status).toBe(401);
  });

  test("rejects an anonymous business command before reading its body", async () => {
    let reads = 0;
    const response = await testApp({ requestBodyLimitBytes: 8 }).request("/v1/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: streamedBody(64, () => reads++),
    });
    expect(response.status).toBe(401);
    expect(reads).toBe(0);

    const authenticated = await testApp({ authenticated: true, requestBodyLimitBytes: 8 }).request(
      "/v1/sales",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: streamedBody(64, () => reads++),
      },
    );
    expect(authenticated.status).toBe(413);
    expect(await authenticated.json()).toMatchObject({ error: { code: "BAD_REQUEST" } });
    expect(reads).toBe(1);
  });

  test("rejects a declared oversized body before reading the session", async () => {
    let sessions = 0;
    const response = await testApp({
      authenticated: true,
      requestBodyLimitBytes: 8,
      onSessionRead: () => sessions++,
    }).request("/v1/sales", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "9" },
      body: "{}",
    });
    expect(response.status).toBe(413);
    expect(sessions).toBe(0);
  });

  test("only exempts literal session-policy paths", () => {
    expect(() => sessionPolicyPaths({ routes: [{ path: "/v1/billing/:id" }] })).toThrow(
      "static path",
    );
    expect([...sessionPolicyPaths({ routes: [{ path: "/v1/me" }] })]).toEqual(["/v1/me"]);
  });

  test("accepts an empty customer portal body", async () => {
    const response = await testApp({ authenticated: true, polarEnabled: true }).request(
      "/v1/billing/portal",
      { method: "POST", headers: { "content-type": "application/json" }, body: "" },
    );
    expect(response.status).toBe(200);
  });

  test("logs the readiness failure type without the driver message", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const response = await testApp({
        ping: async () => {
          throw new TypeError("postgres://user:secret@db/private");
        },
      }).request("/ready");
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({ checks: { database: "error" } });
      const logs = warn.mock.calls.map(([value]) => JSON.parse(String(value)));
      expect(logs).toEqual([
        { level: "warn", message: "Readiness database check failed", errorType: "TypeError" },
      ]);
    } finally {
      warn.mockRestore();
    }
  });
});
