import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";

import type { CashRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { normalizeError } from "../src/errors.ts";
import { cashRoutes } from "../src/routes/cash.ts";

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
  const routes = cashRoutes({ auth, cash: options.cash });
  routes.onError((error, context) => {
    const { apiError } = normalizeError(error);
    return context.json(
      { error: { code: apiError.code, message: apiError.message, requestId: "test-request" } },
      apiError.status,
    );
  });
  return routes;
}

function repository(overrides: Partial<CashRepository>): CashRepository {
  return overrides as CashRepository;
}

describe("cash and expense API routes", () => {
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
