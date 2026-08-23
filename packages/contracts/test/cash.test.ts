import { describe, expect, test } from "bun:test";

import {
  cashAccountCommandResultSchema,
  cashAccountListQuerySchema,
  createCashAccountRequestSchema,
  expensePeriodQuerySchema,
  postExpenseRequestSchema,
  signedCashAggregateMinorUnitsSchema,
  signedCashMinorUnitsSchema,
  transferCashRequestSchema,
  updateCashAccountRequestSchema,
} from "../src/cash.ts";

const idempotencyKey = "85d434e5-a7fd-49b7-9f12-38aa80a920ae";
const accountId = "71402e0c-b17d-4d8c-83ae-8d163d10d51d";

describe("cash and expense contracts", () => {
  test("accepts an account with an explicit opening movement in the selected currency", () => {
    expect(
      createCashAccountRequestSchema.safeParse({
        idempotencyKey,
        name: "Caja principal",
        kind: "cash",
        allowNegativeBalance: false,
        currency: "GTQ",
        opening: {
          direction: "in",
          amountMinorUnits: "125000",
          occurredLocalDate: "2026-08-22",
          occurredLocalTime: "09:15",
          reason: "Saldo inicial contado",
        },
      }).success,
    ).toBe(true);
  });

  test("requires the caller to state that an account starts at zero", () => {
    expect(
      createCashAccountRequestSchema.safeParse({
        idempotencyKey,
        name: "Cuenta digital",
        kind: "mobile_money",
        allowNegativeBalance: false,
        currency: "USD",
        opening: null,
      }).success,
    ).toBe(true);
    expect(
      createCashAccountRequestSchema.safeParse({
        idempotencyKey,
        name: "Cuenta digital",
        kind: "mobile_money",
        allowNegativeBalance: false,
        currency: "USD",
      }).success,
    ).toBe(false);
  });

  test("rejects unknown mutation fields and empty account updates", () => {
    expect(
      postExpenseRequestSchema.safeParse({
        idempotencyKey,
        accountId,
        category: "rent",
        amountMinorUnits: "5000",
        currency: "USD",
        description: "Alquiler",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "10:00",
        businessId: "untrusted-business",
      }).success,
    ).toBe(false);
    expect(updateCashAccountRequestSchema.safeParse({ idempotencyKey }).success).toBe(false);
  });

  test("keeps exact signed values canonical", () => {
    expect(signedCashMinorUnitsSchema.safeParse("-9223372036854775807").success).toBe(true);
    expect(signedCashMinorUnitsSchema.safeParse("-0").success).toBe(false);
    expect(signedCashMinorUnitsSchema.safeParse("01").success).toBe(false);
    expect(signedCashMinorUnitsSchema.safeParse("9223372036854775808").success).toBe(false);
    expect(signedCashAggregateMinorUnitsSchema.safeParse("-18446744073709551614").success).toBe(
      true,
    );
  });

  test("rejects a same-account transfer before the repository", () => {
    expect(
      transferCashRequestSchema.safeParse({
        idempotencyKey,
        fromAccountId: accountId,
        toAccountId: accountId,
        amountMinorUnits: "100",
        currency: "USD",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "12:00",
      }).success,
    ).toBe(false);
  });

  test("bounds list pagination and requires an inclusive local period", () => {
    expect(cashAccountListQuerySchema.parse({})).toEqual({ limit: 25, status: "active" });
    expect(cashAccountListQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(
      expensePeriodQuerySchema.safeParse({
        startLocalDate: "2026-08-01",
        endLocalDate: "2026-08-31",
      }).success,
    ).toBe(true);
  });

  test("validates a persisted account command result without inventing currency defaults", () => {
    const result = cashAccountCommandResultSchema.safeParse({
      account: {
        id: accountId,
        name: "Banco",
        kind: "bank",
        status: "active",
        allowNegativeBalance: true,
        currency: "EUR",
        currencyMinorUnitDigits: 2,
        balanceMinorUnits: "-250",
        createdAt: "2026-08-22T15:00:00.000Z",
        updatedAt: "2026-08-22T15:00:00.000Z",
      },
      openingMovement: null,
      replayed: false,
    });

    expect(result.success).toBe(true);
  });
});
