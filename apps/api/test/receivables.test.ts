import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import { ProductError } from "@pisto/db";
import { Hono } from "hono";

import type { ReceivablesRepository } from "../../../packages/db/src/receivables.ts";
import { ApiError } from "../src/errors.ts";
import { receivablesRoutes } from "../src/routes/receivables.ts";
import type { AppEnv } from "../src/types.ts";

const customerId = "8f07cf88-4fee-4c54-9ce8-49823d12af68";
const receivableId = "06a0a76b-5fa7-4687-8086-8525c90d59d7";
const idempotencyKey = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";

function createTestApp(repository: Partial<ReceivablesRepository>, authenticated = true) {
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
  app.route("/v1", receivablesRoutes({ auth, receivables: repository as ReceivablesRepository }));
  app.onError((error, context) => {
    const normalized =
      error instanceof ApiError
        ? error
        : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
    return context.json(
      {
        error: {
          code: normalized.code,
          message: normalized.message,
          requestId: "request_test",
        },
      },
      normalized.status,
    );
  });
  return app;
}

describe("customers and receivables routes", () => {
  test("requires authentication before customer data is read", async () => {
    let called = false;
    const response = await createTestApp(
      {
        listCustomers: async () => {
          called = true;
          return { items: [], nextCursor: null };
        },
      },
      false,
    ).request("/v1/customers");

    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  test("rejects client-selected tenant and state before posting a charge", async () => {
    let called = false;
    const response = await createTestApp({
      postReceivable: async () => {
        called = true;
        throw new Error("Repository should not be called");
      },
    }).request("/v1/receivables", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey,
        customerId,
        originalMinorUnits: "1250",
        description: "Order 104",
        postedDate: "2026-08-22",
        businessId: "another-business",
        state: "paid",
      }),
    });

    expect(response.status).toBe(400);
    expect(called).toBe(false);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("passes a server-derived actor and strict customer command to the repository", async () => {
    let received: unknown;
    const response = await createTestApp({
      createCustomer: async (actor, command) => {
        received = { actor, command };
        return {
          replayed: false,
          customer: {
            id: customerId,
            name: command.name,
            phone: command.phone ?? null,
            email: command.email ?? null,
            notes: command.notes ?? null,
            status: "active",
            createdAt: "2026-08-22T12:00:00.000Z",
            updatedAt: "2026-08-22T12:00:00.000Z",
          },
        };
      },
    }).request("/v1/customers", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idempotencyKey, name: "Ada Lovelace", phone: "+503 7000 0000" }),
    });

    expect(response.status).toBe(201);
    expect(received).toEqual({
      actor: {
        userId: "user_test",
        sessionId: "session_test",
        activeBusinessId: "business_test",
      },
      command: { idempotencyKey, name: "Ada Lovelace", phone: "+503 7000 0000" },
    });
  });

  test("maps overpayment and tenant-undisclosed reads without leaking implementation details", async () => {
    const overpayment = await createTestApp({
      applyPayment: async () => {
        throw new ProductError("CONFLICT", "The payment exceeds the outstanding balance");
      },
    }).request(`/v1/receivables/${receivableId}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        idempotencyKey,
        amountMinorUnits: "1250",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "14:30",
        cashAccountId: "2a903e1a-fe22-4b26-b657-0ca5fdc8ac90",
      }),
    });
    const hidden = await createTestApp({
      getReceivable: async () => {
        throw new ProductError("NOT_FOUND", "Receivable was not found");
      },
    }).request(`/v1/receivables/${receivableId}`);

    expect(overpayment.status).toBe(409);
    expect(await overpayment.json()).toMatchObject({ error: { code: "CONFLICT" } });
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  test("bounds list filters before calling the repository", async () => {
    let called = false;
    const response = await createTestApp({
      listReceivables: async () => {
        called = true;
        return { items: [], nextCursor: null };
      },
    }).request("/v1/receivables?limit=51&state=overdue");

    expect(response.status).toBe(400);
    expect(called).toBe(false);
  });
});
