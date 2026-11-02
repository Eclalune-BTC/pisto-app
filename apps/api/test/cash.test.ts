import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { CashRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { z } from "zod";
import { cashRoutes } from "../src/routes/cash.ts";
import { protectedRoutes, queryContract } from "../src/routes/protected.ts";
import { testAccess, testClient, testErrorBoundary } from "./http-client.ts";

const accountId = "71402e0c-b17d-4d8c-83ae-8d163d10d51d";
const idempotencyKey = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";

function testRoutes(options: { authenticated?: boolean; cash: CashRepository }) {
  const auth = {
    api: {
      getSession: async () =>
        options.authenticated === false
          ? null
          : {
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
                activeOrganizationId: "business_test",
              },
            },
    },
  } as unknown as Auth;
  return testClient(
    testErrorBoundary("test-request").use(
      cashRoutes({ access: testAccess(auth), cash: options.cash }),
    ),
    "/v1",
  );
}

function repository(overrides: Partial<CashRepository>): CashRepository {
  return overrides as CashRepository;
}

describe("cash and expense API routes", () => {
  test("rejects a repeated key and any parameter outside the contract", async () => {
    let received: unknown;
    const routes = testRoutes({
      cash: repository({
        listAccounts: async (_actor, query) => {
          received = query;
          return { items: [], nextCursor: null, queriedAt: "2026-10-03T12:00:00.000Z" };
        },
      }),
    });
    for (const search of ["limit=5&limit=99", "limit=5&limit=5", "businessId=a&businessId=b"]) {
      const rejected = await routes.request(`/cash/accounts?${search}`);
      expect(rejected.status).toBe(400);
      const key = search.split("=", 1)[0] as string;
      expect(await rejected.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
          message: "Cash account list query is invalid",
          details: { fieldErrors: { [key]: ["Provide this query parameter only once"] } },
        },
      });
    }
    for (const search of ["limit=5&businessId=other", "limit=5&=x", "__proto__=x", "Limit=5"]) {
      const rejected = await routes.request(`/cash/accounts?${search}`);
      expect(rejected.status).toBe(400);
      expect(await rejected.json()).toMatchObject({
        error: { code: "VALIDATION_ERROR", message: "Cash account list query is invalid" },
      });
    }
    expect(received).toBeUndefined();
    const accepted = await routes.request("/cash/accounts?limit=5");
    expect(accepted.status).toBe(200);
    expect(received).toEqual({ limit: 5, status: "active" });
  });
  test("requires authentication before any cash read", async () => {
    const response = await testRoutes({
      authenticated: false,
      cash: repository({}),
    }).request("/cash/accounts");

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  });

  test("rejects client-selected tenancy before calling the repository", async () => {
    let called = false;
    const response = await testRoutes({
      cash: repository({
        postExpense: async () => {
          called = true;
          throw new Error("must not be called");
        },
      }),
    }).request("/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey,
        accountId,
        category: "rent",
        amountMinorUnits: "5000",
        currency: "USD",
        description: "Alquiler",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "10:00",
        businessId: "another-business",
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(called).toBe(false);
  });

  test("passes only the fresh session actor and validated expense command", async () => {
    let captured: unknown;
    const response = await testRoutes({
      cash: repository({
        postExpense: async (actor, command) => {
          captured = { actor, command };
          return {
            expense: { id: "5f307872-b71d-41ed-887f-ee872bcc6a44" },
            movement: { id: "95f7e68f-adde-44d8-836c-38488ec66a1d" },
            replayed: false,
          } as never;
        },
      }),
    }).request("/expenses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey,
        accountId,
        category: "rent",
        amountMinorUnits: "5000",
        currency: "USD",
        description: "Alquiler",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "10:00",
      }),
    });

    expect(response.status).toBe(201);
    expect(captured).toEqual({
      actor: {
        userId: "user_test",
        sessionId: "session_test",
        activeBusinessId: "business_test",
      },
      command: {
        idempotencyKey,
        accountId,
        category: "rent",
        amountMinorUnits: "5000",
        currency: "USD",
        description: "Alquiler",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "10:00",
        entrySource: "manual",
      },
    });
  });

  test("maps exact domain conflicts and keeps summary routing unambiguous", async () => {
    const routes = testRoutes({
      cash: repository({
        transfer: async () => {
          throw new ProductError("CONFLICT", "Cash account has insufficient funds");
        },
        getExpensePeriodSummary: async (_actor, query) =>
          ({ periodStartLocal: query.startLocalDate }) as never,
      }),
    });
    const transfer = await routes.request("/cash/transfers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey,
        fromAccountId: accountId,
        toAccountId: "fa4c22aa-258c-4403-a292-322cf19cfa61",
        amountMinorUnits: "100",
        currency: "USD",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "12:00",
      }),
    });
    const summary = await routes.request(
      "/expenses/summary?startLocalDate=2026-08-01&endLocalDate=2026-08-31",
    );

    expect(transfer.status).toBe(409);
    expect(await transfer.json()).toMatchObject({ error: { code: "CONFLICT" } });
    expect(summary.status).toBe(200);
    expect(await summary.json()).toEqual({
      data: { summary: { periodStartLocal: "2026-08-01" } },
    });
  });
});

describe("protected route declarations", () => {
  test("refuses a query contract that would accept unknown keys", () => {
    expect(() => queryContract(z.object({ limit: z.string() }), "Query is invalid")).toThrow(
      "Query is invalid: the query contract must be a strict object",
    );
    expect(() =>
      queryContract(z.object({ limit: z.string() }).strict(), "Query is invalid"),
    ).not.toThrow();
  });

  test("fails a record field that is not a route parameter instead of hiding it as 404", async () => {
    const auth = {
      api: {
        getSession: async () => ({
          user: { id: "user_test" },
          session: { id: "session_test", activeOrganizationId: "business_test" },
        }),
      },
    } as unknown as Auth;
    const app = testClient(
      testErrorBoundary().use(
        protectedRoutes(testAccess(auth))
          .get("/things/:thingId", () => ({ data: null }), { record: { itemId: "Not found" } })
          .post("/things/:thingId", () => ({ data: null }), { record: { itemId: "Not found" } }),
      ),
    );
    const get = await app.request(`/v1/things/${accountId}`);
    expect(get.status).toBe(500);
    const post = await app.request(`/v1/things/${accountId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(post.status).toBe(500);
  });
});
