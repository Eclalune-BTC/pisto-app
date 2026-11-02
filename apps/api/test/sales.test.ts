import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { SaleList } from "@pisto/contracts";
import type { SalesRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { salesRoutes } from "../src/routes/sales.ts";
import { testAccess, testClient, testErrorBoundary } from "./http-client.ts";

const emptyPage: SaleList = {
  items: [],
  nextCursor: null,
  queriedAt: "2026-08-22T20:30:00.000Z",
};

function createTestApp(repository: Partial<SalesRepository>, authenticated = true) {
  const auth = {
    api: {
      getSession: async () =>
        authenticated
          ? {
              user: { id: "user_test" },
              session: {
                id: "session_test",
                activeOrganizationId: "business_test",
                expiresAt: new Date(Date.now() + 60_000),
              },
            }
          : null,
    },
  } as unknown as Auth;
  return testClient(
    testErrorBoundary().use(
      salesRoutes({ access: testAccess(auth), sales: repository as SalesRepository }),
    ),
  );
}

describe("sales list route", () => {
  test("requires authentication before the sale history is read", async () => {
    let called = false;
    const response = await createTestApp(
      {
        listSales: async () => {
          called = true;
          return { ...emptyPage };
        },
      },
      false,
    ).request("/v1/sales");

    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  test("bounds the page and rejects an unowned filter before the repository runs", async () => {
    let called = false;
    const app = createTestApp({
      listSales: async () => {
        called = true;
        throw new Error("Repository should not be called");
      },
    });

    const tooLarge = await app.request("/v1/sales?limit=51");
    const tooSmall = await app.request("/v1/sales?limit=0");
    const unknownStatus = await app.request("/v1/sales?status=corrected");

    expect([tooLarge.status, tooSmall.status, unknownStatus.status]).toEqual([400, 400, 400]);
    expect(await tooLarge.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(called).toBe(false);
  });

  test("rejects a client-chosen tenant instead of reading it", async () => {
    let called = false;
    const response = await createTestApp({
      listSales: async () => {
        called = true;
        return { ...emptyPage };
      },
    }).request("/v1/sales?businessId=another-business");

    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    expect(called).toBe(false);
  });

  test("rejects an unknown filter and forwards only contract filters", async () => {
    let received: unknown;
    const app = createTestApp({
      listSales: async (_actor, query) => {
        received = query;
        return { ...emptyPage };
      },
    });

    const unknown = await app.request("/v1/sales?status=voided&utm_source=x");
    expect(unknown.status).toBe(400);
    expect(received).toBeUndefined();

    const response = await app.request("/v1/sales?status=voided&limit=10&cursor=eyJ2IjoxfQ");
    expect(response.status).toBe(200);
    expect(received).toEqual({ cursor: "eyJ2IjoxfQ", limit: 10, status: "voided" });
  });

  test("returns the repository page unchanged, including a truthful correction", async () => {
    const correctedAt = "2026-08-22T20:30:00.000Z";
    const originalSaleId = "5312a3e6-7c91-486a-9233-0cf4d9d3dcc7";
    const page = {
      items: [
        {
          id: originalSaleId,
          status: "voided" as const,
          entryMode: "total_only" as const,
          entrySource: "manual" as const,
          customer: null,
          grossMinorUnits: "1250",
          currency: "USD",
          currencyMinorUnitDigits: 2,
          occurredAt: correctedAt,
          occurredLocalDate: "2026-08-22",
          occurredLocalTime: "14:30",
          timeZone: "America/El_Salvador",
          description: null,
          correction: {
            id: "3ce0fe40-da34-4fc4-b8a6-0b9b3df52136",
            kind: "void" as const,
            reason: "Duplicate sale",
            originalSaleId,
            replacementSaleId: null,
            correctedAt,
          },
          createdAt: correctedAt,
        },
      ],
      nextCursor: "eyJ2ZXJzaW9uIjoxfQ",
      queriedAt: correctedAt,
    };
    const response = await createTestApp({ listSales: async () => page }).request("/v1/sales");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: page });
  });

  test("maps a domain refusal to its unchanged public status", async () => {
    const denied = await createTestApp({
      listSales: async () => {
        throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
      },
    }).request("/v1/sales");
    const staleCursor = await createTestApp({
      listSales: async () => {
        throw new ProductError("VALIDATION_ERROR", "The page cursor is invalid for this query");
      },
    }).request("/v1/sales?cursor=eyJ2IjoxfQ");
    const noBusiness = await createTestApp({
      listSales: async () => {
        throw new ProductError(
          "BUSINESS_REQUIRED",
          "Select or create a business before continuing",
        );
      },
    }).request("/v1/sales");

    expect(denied.status).toBe(403);
    expect(staleCursor.status).toBe(400);
    expect(noBusiness.status).toBe(409);
    expect(await staleCursor.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });
});

describe("durable sale review routes", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const request = (path: string, body: unknown) =>
    new Request(`http://localhost/v1/sales/review${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  test("protects all review routes before calling a repository", async () => {
    const app = createTestApp({}, false);
    expect((await app.request("/v1/sales/review")).status).toBe(401);
    for (const path of ["", `/${id}/confirm`, `/${id}/dismiss`]) {
      expect((await app.request(request(path, {}))).status).toBe(401);
    }
  });
  test("resolves the static review read instead of interpreting it as a sale ID", async () => {
    const app = createTestApp({
      getSaleReview: async (actor) => {
        expect(actor.activeBusinessId).toBe("business_test");
        return null;
      },
    });
    const response = await app.request("/v1/sales/review");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { review: null } });
  });
  test("rejects command ownership, invalid IDs, and replacement data", async () => {
    const app = createTestApp({});
    expect((await app.request(request("", { businessId: "foreign" }))).status).toBe(400);
    expect((await app.request(request("/bad/confirm", {}))).status).toBe(404);
    expect((await app.request(request(`/${id}/confirm`, { grossMinorUnits: "1" }))).status).toBe(
      400,
    );
    expect((await app.request(request(`/${id}/dismiss`, {}))).status).toBe(400);
  });
  test("passes explicit saved-sale acknowledgement through the authenticated boundary", async () => {
    let received: unknown;
    const app = createTestApp({
      dismissSaleReview: async (actor, reviewId, acknowledgedSaleId) => {
        received = { actor, reviewId, acknowledgedSaleId };
        return { saleId: id };
      },
    });
    const response = await app.request(request(`/${id}/dismiss`, { acknowledgedSaleId: id }));
    expect(response.status).toBe(200);
    expect(received).toEqual({
      actor: { userId: "user_test", sessionId: "session_test", activeBusinessId: "business_test" },
      reviewId: id,
      acknowledgedSaleId: id,
    });
    expect(await response.json()).toEqual({ data: { saleId: id } });
  });
});

describe("itemized sale routes", () => {
  const saleId = "5312a3e6-7c91-486a-9233-0cf4d9d3dcc7";
  const productId = "0c0f4c55-3a52-4a39-9d0a-4cf1f3e2b9a1";
  const accountId = "a8d0b1a6-5f1c-4c55-9a39-2f8d4bd7f6a2";
  const command = {
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    occurredLocalDate: "2026-11-02",
    occurredLocalTime: "10:15",
    lines: [{ productId, quantityMinorUnits: "2" }],
    payment: { method: "cash", accountId, receivedMinorUnits: "500" },
  };
  const post = (body: unknown) =>
    new Request("http://localhost/v1/sales/itemized", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const result = {
    sale: {
      id: saleId,
      status: "posted" as const,
      entryMode: "itemized" as const,
      entrySource: "manual" as const,
      customer: null,
      grossMinorUnits: "500",
      currency: "USD",
      currencyMinorUnitDigits: 2,
      occurredAt: "2026-11-02T16:15:00.000Z",
      occurredLocalDate: "2026-11-02",
      occurredLocalTime: "10:15",
      timeZone: "America/El_Salvador",
      description: null,
      correction: null,
      createdAt: "2026-11-02T16:15:01.000Z",
    },
    lines: [
      {
        id: "3ce0fe40-da34-4fc4-b8a6-0b9b3df52136",
        productId,
        productName: "Café molido 1 lb",
        quantityMinorUnits: "2",
        quantityPrecision: 0,
        unitPriceMinorUnits: "250",
        subtotalMinorUnits: "500",
      },
    ],
    settlement: {
      customerId: null,
      customerName: null,
      paymentMethod: "cash" as const,
      accountId,
      receivedMinorUnits: "500",
      creditMinorUnits: "0",
      receivableId: null,
      dueDate: null,
    },
  };

  test("requires a session before the command reaches the repository", async () => {
    let called = false;
    const app = createTestApp(
      {
        createItemizedSale: async () => {
          called = true;
          return { ...result, replayed: false };
        },
      },
      false,
    );
    expect((await app.request(post(command))).status).toBe(401);
    expect((await app.request("/v1/sales/form-options")).status).toBe(401);
    expect(called).toBe(false);
  });

  test("rejects client-chosen tenants, prices without lines and amounts as numbers", async () => {
    let called = false;
    const app = createTestApp({
      createItemizedSale: async () => {
        called = true;
        return { ...result, replayed: false };
      },
    });
    const invalid = [
      { ...command, businessId: "another-business" },
      { ...command, lines: [] },
      { ...command, grossMinorUnits: "500" },
      { ...command, lines: [{ productId, quantityMinorUnits: 2 }] },
      { ...command, payment: { ...command.payment, receivedMinorUnits: "0" } },
      { ...command, entrySource: "assistant" },
    ];
    for (const body of invalid) {
      const response = await app.request(post(body));
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    }
    expect(called).toBe(false);
  });

  test("forwards the parsed command with its default source and answers 201, then 200 on replay", async () => {
    const received: unknown[] = [];
    let replayed = false;
    const app = createTestApp({
      createItemizedSale: async (actor, body) => {
        received.push({ actor, body });
        const response = { ...result, replayed };
        replayed = true;
        return response;
      },
    });
    const first = await app.request(post(command));
    const second = await app.request(post(command));
    expect([first.status, second.status]).toEqual([201, 200]);
    expect(received[0]).toEqual({
      actor: { userId: "user_test", sessionId: "session_test", activeBusinessId: "business_test" },
      body: { ...command, entrySource: "manual" },
    });
    expect(await first.json()).toEqual({ data: { ...result, replayed: false } });
  });

  test("maps stock and permission refusals to their public status", async () => {
    const conflict = await createTestApp({
      createItemizedSale: async () => {
        throw new ProductError("CONFLICT", "There is not enough stock for this sale");
      },
    }).request(post(command));
    const denied = await createTestApp({
      getSaleFormOptions: async () => {
        throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
      },
    }).request("/v1/sales/form-options");
    expect(conflict.status).toBe(409);
    expect(denied.status).toBe(403);
  });

  test("serves payment accounts on a static path, not as a sale identifier", async () => {
    const accounts = [{ id: accountId, name: "Caja", kind: "cash" as const }];
    const app = createTestApp({ getSaleFormOptions: async () => ({ accounts }) });
    const response = await app.request("/v1/sales/form-options");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { accounts } });
  });

  test("returns an itemized sale's lines and settlement with its detail", async () => {
    const app = createTestApp({
      getSale: async (_actor, id) => {
        expect(id).toBe(saleId);
        return {
          sale: result.sale,
          details: { lines: result.lines, settlement: result.settlement },
        };
      },
    });
    const response = await app.request(`/v1/sales/${saleId}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        sale: result.sale,
        details: { lines: result.lines, settlement: result.settlement },
        replayed: false,
      },
    });
  });
});
