import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { CatalogRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { Hono } from "hono";

import { ApiError } from "../src/errors.ts";
import { catalogRoutes } from "../src/routes/catalog.ts";

const actorSession = {
  session: {
    id: "session-1",
    expiresAt: new Date(Date.now() + 60_000),
    activeOrganizationId: "business-from-session",
  },
  user: {
    id: "user-1",
    name: "Owner",
    email: "owner@example.test",
    emailVerified: true,
  },
};

function createAuth(): Auth {
  return {
    api: { getSession: async () => actorSession },
  } as unknown as Auth;
}

function createRepository(overrides: Partial<CatalogRepository> = {}): CatalogRepository {
  const unsupported = async () => {
    throw new Error("Unexpected repository call");
  };
  return {
    archiveCategory: unsupported,
    archiveProduct: unsupported,
    createCategory: unsupported,
    createProduct: unsupported,
    getProduct: unsupported,
    listCategories: unsupported,
    listMovements: unsupported,
    listProducts: unsupported,
    listStock: unsupported,
    recordMovement: unsupported,
    reverseMovement: unsupported,
    updateCategory: unsupported,
    updateProduct: unsupported,
    ...overrides,
  } as CatalogRepository;
}

function createApp(repository: CatalogRepository) {
  const app = new Hono();
  app.route("/v1", catalogRoutes({ auth: createAuth(), catalog: repository }));
  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json(
        {
          error: {
            code: error.code,
            message: error.message,
            requestId: "catalog-test",
            details: error.details,
          },
        },
        error.status,
      );
    }
    return context.json({ error: { code: "INTERNAL_ERROR" } }, 500);
  });
  return app;
}

describe("catalog HTTP routes", () => {
  test("derives the actor business from the authenticated session", async () => {
    let receivedBusiness: string | null | undefined;
    const app = createApp(
      createRepository({
        listProducts: async (actor, query) => {
          receivedBusiness = actor.activeBusinessId;
          expect(query).toEqual({ limit: 25, status: "active" });
          return { items: [], nextCursor: null };
        },
      }),
    );

    const response = await app.request("/v1/catalog/products");
    expect(response.status).toBe(200);
    expect(receivedBusiness).toBe("business-from-session");
    expect(await response.json()).toEqual({ data: { items: [], nextCursor: null } });
  });

  test("rejects unknown mutation fields before the repository", async () => {
    const app = createApp(createRepository());
    const response = await app.request("/v1/catalog/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: "79e49c32-9539-408d-9b20-004db69f78ca",
        name: "Coffee",
        unitKind: "unit",
        quantityPrecision: 0,
        tracked: true,
        businessId: "untrusted-business",
      }),
    });
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  test("returns 200 for an exact idempotent replay and 201 for a new movement", async () => {
    const productId = "27184a8c-850d-4865-a2fe-41635645dce1";
    const movement = {
      id: "c40cfacd-5321-491d-9e79-25fc062c32b4",
      productId,
      action: "receive" as const,
      quantityMinorUnits: "5",
      deltaMinorUnits: "5",
      quantityPrecision: 0,
      reason: "Opening count",
      occurredAt: "2026-08-22T20:30:00.000Z",
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "14:30",
      timeZone: "America/El_Salvador",
      createdByUserId: "user-1",
      reversesMovementId: null,
      reversedByMovementId: null,
      createdAt: "2026-08-22T20:31:00.000Z",
    };
    const stock = {
      productId,
      quantityPrecision: 0,
      onHandMinorUnits: "5",
      lowStockThresholdMinorUnits: "2",
      lowStock: false,
    };
    let replayed = false;
    const app = createApp(
      createRepository({
        recordMovement: async () => ({ movement, stock, replayed }),
      }),
    );
    const body = JSON.stringify({
      idempotencyKey: "56bbdf0c-6737-46a7-80ca-99a4209b9658",
      action: "receive",
      quantityMinorUnits: "5",
      reason: "Opening count",
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "14:30",
    });
    const first = await app.request(`/v1/inventory/products/${productId}/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(first.status).toBe(201);
    replayed = true;
    const replay = await app.request(`/v1/inventory/products/${productId}/movements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(replay.status).toBe(200);
  });

  test("maps domain conflicts and invalid undisclosed identifiers", async () => {
    const app = createApp(
      createRepository({
        reverseMovement: async () => {
          throw new ProductError("CONFLICT", "The movement was already reversed");
        },
      }),
    );
    const invalid = await app.request("/v1/inventory/movements/not-a-uuid/reverse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(invalid.status).toBe(404);

    const conflict = await app.request(
      "/v1/inventory/movements/a9a2c010-518d-41d5-924d-ac8fe0c57aa4/reverse",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: "585bcd2e-42cb-4284-a043-32962768ce28",
          reason: "Duplicate count",
          occurredLocalDate: "2026-08-22",
          occurredLocalTime: "14:30",
        }),
      },
    );
    expect(conflict.status).toBe(409);
    expect((await conflict.json()).error.code).toBe("CONFLICT");
  });
});
