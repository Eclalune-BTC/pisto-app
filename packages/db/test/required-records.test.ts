import { describe, expect, test } from "bun:test";
import { getAccountBalance } from "../src/cash/access.ts";
import { toCashAccount, toCashMovement, toExpense } from "../src/cash/mappers.ts";
import { toCategory, toProduct } from "../src/catalog/codec.ts";
import { currentBalance } from "../src/catalog/operations.ts";
import { getPaidMinorUnits } from "../src/receivables/access.ts";
import { deriveReceivableBalance, toCustomer, toPayment } from "../src/receivables/mappers.ts";
import { toCorrection, toSale } from "../src/sales-records.ts";

function aggregateExecutor(rows: unknown[]) {
  const query = { from: () => query, where: async () => rows };
  return { select: () => query };
}

describe("required aggregate query results", () => {
  for (const [name, read, field] of [
    ["cash", getAccountBalance, "value"],
    ["inventory", currentBalance, "value"],
    ["receivable", getPaidMinorUnits, "paid"],
  ] as const) {
    test(`${name} accepts a real SQL zero but not a missing or malformed result`, async () => {
      expect(await read(aggregateExecutor([{ [field]: "0" }]) as never, "business", "record")).toBe(
        0n,
      );
      for (const rows of [[], [{}], [{ [field]: null }], [{ [field]: "" }], [{ [field]: "NaN" }]]) {
        await expect(
          read(aggregateExecutor(rows) as never, "business", "record"),
        ).rejects.toThrow();
      }
    });
  }
});

const record = {
  id: "10000000-0000-4000-8000-000000000001",
  name: "Coffee",
  status: "active",
  kind: "cash",
  createdAt: new Date("2026-09-01T00:00:00Z"),
  updatedAt: new Date("2026-09-01T00:00:00Z"),
  occurredAt: new Date("2026-09-01T00:00:00Z"),
  grossMinorUnits: 1n,
  amountMinorUnits: 1n,
  deltaMinorUnits: 1n,
  unitKind: "unit",
  entryMode: "total_only",
  direction: "in",
  action: "opening",
};

describe("stored record discriminants", () => {
  test("does not replace an invalid stored sale mode with the manual mode", () => {
    for (const entryMode of ["unknown", "", undefined]) {
      expect(() => toSale({ ...record, status: "posted", entryMode } as never)).toThrow(
        "entry mode",
      );
    }
  });
  test("does not turn unknown catalog, customer or sale states into active records", () => {
    for (const value of ["unknown", "", undefined]) {
      const invalid = { ...record, status: value };
      expect(() => toCategory(invalid as never)).toThrow();
      expect(() => toProduct(invalid as never)).toThrow();
      expect(() => toCustomer(invalid as never)).toThrow();
      expect(() => toSale(invalid as never)).toThrow();
      expect(() => toCashAccount(invalid as never, "0")).toThrow();
      expect(() => toExpense(invalid as never)).toThrow();
      expect(() =>
        deriveReceivableBalance({
          dueDate: null,
          localDate: "2026-09-01",
          originalMinorUnits: 1n,
          paidMinorUnits: 0n,
          status: value as never,
        }),
      ).toThrow();
    }
  });

  test("does not invent a payment, correction or cash operation kind", () => {
    expect(() => toPayment({ ...record, kind: "unknown" } as never)).toThrow();
    expect(() => toCorrection({ ...record, kind: "unknown" } as never)).toThrow();
    expect(() => toCashMovement({ ...record, action: "unknown" } as never)).toThrow();
    expect(() => toCashMovement({ ...record, direction: "unknown" } as never)).toThrow();
    expect(toCategory(record as never).status).toBe("active");
    expect(toCustomer({ ...record, status: "archived" } as never).status).toBe("archived");
    expect(toPayment({ ...record, kind: "reversal" } as never).kind).toBe("reversal");
    expect(toSale({ ...record, status: "posted" } as never).status).toBe("posted");
  });
});
