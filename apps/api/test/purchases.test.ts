import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { PurchasesRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { purchasesRoutes } from "../src/routes/purchases.ts";
import { testAccess, testClient, testErrorBoundary } from "./http-client.ts";

const supplierId = "8f07cf88-4fee-4c54-9ce8-49823d12af68";
const purchaseId = "06a0a76b-5fa7-4687-8086-8525c90d59d7";
const productId = "2a903e1a-fe22-4b26-b657-0ca5fdc8ac90";
const accountId = "5b1f9a2c-7d3e-4f6a-8b9c-0d1e2f3a4b5c";
const idempotencyKey = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";
const json = { "content-type": "application/json" };

function createTestApp(repository: Partial<PurchasesRepository>, authenticated = true) {
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
      purchasesRoutes({
        access: testAccess(auth),
        purchases: repository as PurchasesRepository,
      }),
    ),
  );
}

const purchaseCommand = {
  idempotencyKey,
  supplierId,
  occurredLocalDate: "2026-11-02",
  occurredLocalTime: "09:30",
  lines: [{ productId, quantityMinorUnits: "48", unitCostMinorUnits: "160" }],
  received: true,
  paymentTerms: "credit",
  dueDate: "2026-11-16",
};

describe("suppliers, purchases and payables routes", () => {
  test("requires authentication before supplier data is read", async () => {
    let called = false;
    const response = await createTestApp(
      {
        listSuppliers: async () => {
          called = true;
          throw new Error("Repository should not be called");
        },
      },
      false,
    ).request("/v1/suppliers");

    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  test("rejects a client-chosen tenant, total or balance before recording a purchase", async () => {
    let called = false;
    const repository = {
      createPurchase: async () => {
        called = true;
        throw new Error("Repository should not be called");
      },
    };
    for (const extra of [
      { businessId: "another-business" },
      { totalMinorUnits: "1" },
      { balanceMinorUnits: "0" },
    ]) {
      const response = await createTestApp(repository).request("/v1/purchases", {
        method: "POST",
        headers: json,
        body: JSON.stringify({ ...purchaseCommand, ...extra }),
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    }
    expect(called).toBe(false);
  });

  test("requires the account of a cash purchase and the due date of a credit one", async () => {
    const app = createTestApp({});
    const cash = await app.request("/v1/purchases", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ ...purchaseCommand, paymentTerms: "cash", dueDate: undefined }),
    });
    const credit = await app.request("/v1/purchases", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ ...purchaseCommand, dueDate: undefined }),
    });

    expect(cash.status).toBe(400);
    expect(credit.status).toBe(400);
  });

  test("passes the server-derived actor and the strict command to the repository", async () => {
    let received: unknown;
    const response = await createTestApp({
      createSupplier: async (actor, command) => {
        received = { actor, command };
        return {
          replayed: false,
          supplier: {
            id: supplierId,
            name: command.name,
            contactName: null,
            phone: null,
            email: null,
            taxId: null,
            creditDays: command.creditDays ?? null,
            notes: null,
            status: "active",
            createdAt: "2026-11-02T12:00:00.000Z",
            updatedAt: "2026-11-02T12:00:00.000Z",
          },
        };
      },
    }).request("/v1/suppliers", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ idempotencyKey, name: "Lácteos San Julián", creditDays: 15 }),
    });

    expect(response.status).toBe(201);
    expect(received).toEqual({
      actor: { userId: "user_test", sessionId: "session_test", activeBusinessId: "business_test" },
      command: { idempotencyKey, name: "Lácteos San Julián", creditDays: 15 },
    });
  });

  test("updates a supplier through PATCH and refuses an empty change", async () => {
    let calls = 0;
    const app = createTestApp({
      updateSupplier: async () => {
        calls++;
        throw new ProductError("CONFLICT", "An archived supplier cannot be changed");
      },
    });
    const empty = await app.request(`/v1/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ idempotencyKey }),
    });
    const archived = await app.request(`/v1/suppliers/${supplierId}`, {
      method: "PATCH",
      headers: json,
      body: JSON.stringify({ idempotencyKey, phone: null }),
    });

    expect(empty.status).toBe(400);
    expect(archived.status).toBe(409);
    expect(calls).toBe(1);
  });

  test("maps overpayment, membership denial and hidden records without leaking details", async () => {
    const overpayment = await createTestApp({
      createSupplierPayment: async () => {
        throw new ProductError("CONFLICT", "The payment exceeds the outstanding balance");
      },
    }).request(`/v1/purchases/${purchaseId}/payments`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        idempotencyKey,
        accountId,
        amountMinorUnits: "1250",
        occurredLocalDate: "2026-11-02",
        occurredLocalTime: "14:30",
      }),
    });
    const denied = await createTestApp({
      getPayablesSummary: async () => {
        throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
      },
    }).request("/v1/payables/summary");
    const malformed = await createTestApp({}).request("/v1/purchases/not-a-uuid/void", {
      method: "POST",
      headers: json,
      body: "{",
    });

    expect(overpayment.status).toBe(409);
    expect(await overpayment.json()).toMatchObject({ error: { code: "CONFLICT" } });
    expect(denied.status).toBe(403);
    expect(malformed.status).toBe(404);
  });

  test("bounds list filters before calling the repository", async () => {
    let called = false;
    const repository = {
      listPurchases: async () => {
        called = true;
        throw new Error("Repository should not be called");
      },
      listSuppliers: async () => {
        called = true;
        throw new Error("Repository should not be called");
      },
    };
    for (const path of [
      "/v1/purchases?limit=51",
      "/v1/purchases?payable=overdue",
      "/v1/suppliers?balance=owed",
      "/v1/suppliers?businessId=another",
    ]) {
      expect((await createTestApp(repository).request(path)).status).toBe(400);
    }
    expect(called).toBe(false);
  });
});
