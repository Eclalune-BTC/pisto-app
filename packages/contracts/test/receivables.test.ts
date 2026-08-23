import { describe, expect, test } from "bun:test";

import {
  applyReceivablePaymentRequestSchema,
  createCustomerRequestSchema,
  listCustomersQuerySchema,
  listReceivablesQuerySchema,
  postReceivableRequestSchema,
  receivableSchema,
  reverseReceivablePaymentRequestSchema,
  updateCustomerRequestSchema,
} from "../src/receivables.ts";

const idempotencyKey = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";

describe("customers and receivables contracts", () => {
  test("rejects tenant, currency, status, and actor fields on commands", () => {
    expect(
      createCustomerRequestSchema.safeParse({
        idempotencyKey,
        name: "Ada Lovelace",
        businessId: "another-business",
      }).success,
    ).toBe(false);
    expect(
      postReceivableRequestSchema.safeParse({
        idempotencyKey,
        customerId: "8f07cf88-4fee-4c54-9ce8-49823d12af68",
        originalMinorUnits: "1250",
        description: "Order 104",
        postedDate: "2026-08-22",
        currency: "USD",
        state: "paid",
      }).success,
    ).toBe(false);
  });

  test("requires an actual customer update", () => {
    expect(updateCustomerRequestSchema.safeParse({ idempotencyKey }).success).toBe(false);
    expect(
      updateCustomerRequestSchema.safeParse({
        idempotencyKey,
        phone: null,
      }).success,
    ).toBe(true);
  });

  test("rejects a due date before the posted date", () => {
    expect(
      postReceivableRequestSchema.safeParse({
        idempotencyKey,
        customerId: "8f07cf88-4fee-4c54-9ce8-49823d12af68",
        originalMinorUnits: "1250",
        description: "Order 104",
        postedDate: "2026-08-22",
        dueDate: "2026-08-21",
      }).success,
    ).toBe(false);
  });

  test("requires canonical positive money and selected cash account", () => {
    expect(
      applyReceivablePaymentRequestSchema.safeParse({
        idempotencyKey,
        amountMinorUnits: "0500",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "13:00",
        cashAccountId: "2a903e1a-fe22-4b26-b657-0ca5fdc8ac90",
      }).success,
    ).toBe(false);
    expect(
      applyReceivablePaymentRequestSchema.safeParse({
        idempotencyKey,
        amountMinorUnits: "500",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "13:00",
      }).success,
    ).toBe(false);
  });

  test("does not allow a reversal to select a different cash account or amount", () => {
    expect(
      reverseReceivablePaymentRequestSchema.safeParse({
        idempotencyKey,
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "13:00",
        amountMinorUnits: "500",
        cashAccountId: "2a903e1a-fe22-4b26-b657-0ca5fdc8ac90",
      }).success,
    ).toBe(false);
  });

  test("bounds list limits and rejects unknown filters", () => {
    expect(listCustomersQuerySchema.safeParse({ limit: "50" }).success).toBe(true);
    expect(listCustomersQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(listReceivablesQuerySchema.safeParse({ state: "written_off" }).success).toBe(false);
    expect(listReceivablesQuerySchema.safeParse({ limit: "25", ownerId: "other" }).success).toBe(
      false,
    );
  });

  test("accepts only derived public states and exact aggregate strings", () => {
    const base = {
      id: "06a0a76b-5fa7-4687-8086-8525c90d59d7",
      customerId: "8f07cf88-4fee-4c54-9ce8-49823d12af68",
      state: "overdue",
      originalMinorUnits: "1250",
      paidMinorUnits: "250",
      outstandingMinorUnits: "1000",
      currency: "USD",
      currencyMinorUnitDigits: 2,
      description: "Order 104",
      postedDate: "2026-08-01",
      dueDate: "2026-08-20",
      voidedAt: null,
      voidReason: null,
      createdAt: "2026-08-01T12:00:00.000Z",
      updatedAt: "2026-08-22T12:00:00.000Z",
    };
    expect(receivableSchema.safeParse(base).success).toBe(true);
    expect(receivableSchema.safeParse({ ...base, state: "past_due" }).success).toBe(false);
    expect(receivableSchema.safeParse({ ...base, paidMinorUnits: 250 }).success).toBe(false);
  });
});
