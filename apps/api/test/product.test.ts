import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { SaleList } from "@pisto/contracts";
import type { ProductRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { Hono } from "hono";
import { normalizeError } from "../src/errors.ts";
import { productRoutes } from "../src/routes/product.ts";
import type { AppEnv } from "../src/types.ts";

const emptyPage: SaleList = {
  items: [],
  nextCursor: null,
  queriedAt: "2026-08-22T20:30:00.000Z",
};

function createTestApp(repository: Partial<ProductRepository>, authenticated = true) {
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
  const app = new Hono<AppEnv>();
  app.route("/v1", productRoutes({ auth, product: repository as ProductRepository }));
  app.onError((error, context) => {
    const { apiError } = normalizeError(error);
    return context.json(
      {
        error: { code: apiError.code, message: apiError.message, requestId: "request_test" },
      },
      apiError.status,
    );
  });
  return app;
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

  test("never lets a client choose the tenant it reads", async () => {
    let received: unknown;
    const response = await createTestApp({
      listSales: async (actor, query) => {
        received = { actor, query };
        return { ...emptyPage };
      },
    }).request("/v1/sales?businessId=another-business");

    expect(response.status).toBe(200);
    expect(received).toEqual({
      actor: { userId: "user_test", sessionId: "session_test", activeBusinessId: "business_test" },
      query: { limit: 25, status: "all" },
    });
  });

  test("forwards only the named filters so an unrelated parameter is not a failure", async () => {
    let received: unknown;
    const response = await createTestApp({
      listSales: async (_actor, query) => {
        received = query;
        return { ...emptyPage };
      },
    }).request("/v1/sales?status=voided&limit=10&cursor=eyJ2IjoxfQ&utm_source=x");

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
