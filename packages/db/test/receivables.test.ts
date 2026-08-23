import { describe, expect, test } from "bun:test";
import { getTableColumns, getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { deriveReceivableBalance } from "../src/receivables.ts";
import { cashMovement } from "../src/schema/cash.ts";
import {
  customer,
  receivable,
  receivableOperation,
  receivablePayment,
} from "../src/schema/receivables.ts";

describe("customers and receivables schema", () => {
  test("owns customer, charge, payment, and operation records", () => {
    expect(getTableName(customer)).toBe("customer");
    expect(getTableName(receivable)).toBe("receivable");
    expect(getTableName(receivablePayment)).toBe("receivable_payment");
    expect(getTableName(receivableOperation)).toBe("receivable_operation");
  });

  test("persists immutable money and occurrence snapshots", () => {
    const receivableColumns = getTableColumns(receivable);
    const paymentColumns = getTableColumns(receivablePayment);

    expect(receivableColumns).toHaveProperty("originalMinorUnits");
    expect(receivableColumns).toHaveProperty("currency");
    expect(receivableColumns).toHaveProperty("currencyMinorUnitDigits");
    expect(receivableColumns).toHaveProperty("postedDate");
    expect(paymentColumns).toHaveProperty("amountMinorUnits");
    expect(paymentColumns).toHaveProperty("occurredAt");
    expect(paymentColumns).toHaveProperty("occurredLocalDate");
    expect(paymentColumns).toHaveProperty("occurredLocalTime");
    expect(paymentColumns).toHaveProperty("timeZone");
  });

  test("persists the selected cash account and append-only reversal link", () => {
    const paymentColumns = getTableColumns(receivablePayment);
    expect(paymentColumns).toHaveProperty("cashAccountId");
    expect(paymentColumns).toHaveProperty("reversesPaymentId");
    expect(getTableColumns(receivableOperation)).toHaveProperty("resultSnapshot");
    expect(getTableConfig(receivablePayment).foreignKeys.map((key) => key.getName())).toContain(
      "receivable_payment_business_cash_account_fk",
    );
    expect(getTableConfig(cashMovement).foreignKeys.map((key) => key.getName())).toContain(
      "cash_movement_business_receivable_payment_fk",
    );
  });

  test("derives open, overdue, paid, and voided state from authoritative amounts and local date", () => {
    expect(
      deriveReceivableBalance({
        dueDate: "2026-08-23",
        localDate: "2026-08-22",
        originalMinorUnits: 1_000n,
        paidMinorUnits: 250n,
        status: "posted",
      }),
    ).toEqual({ outstandingMinorUnits: 750n, state: "open" });
    expect(
      deriveReceivableBalance({
        dueDate: "2026-08-21",
        localDate: "2026-08-22",
        originalMinorUnits: 1_000n,
        paidMinorUnits: 250n,
        status: "posted",
      }).state,
    ).toBe("overdue");
    expect(
      deriveReceivableBalance({
        dueDate: null,
        localDate: "2026-08-22",
        originalMinorUnits: 1_000n,
        paidMinorUnits: 1_000n,
        status: "posted",
      }).state,
    ).toBe("paid");
    expect(
      deriveReceivableBalance({
        dueDate: "2026-08-01",
        localDate: "2026-08-22",
        originalMinorUnits: 1_000n,
        paidMinorUnits: 0n,
        status: "voided",
      }),
    ).toEqual({ outstandingMinorUnits: 0n, state: "voided" });
  });

  test("fails loudly when payment history exceeds the original charge", () => {
    expect(() =>
      deriveReceivableBalance({
        dueDate: null,
        localDate: "2026-08-22",
        originalMinorUnits: 1_000n,
        paidMinorUnits: 1_001n,
        status: "posted",
      }),
    ).toThrow("outstanding balance invariant");
  });
});
