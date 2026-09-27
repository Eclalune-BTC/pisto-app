import { describe, expect, test } from "vitest";
import { validateSaleDraft } from "../sales/sale-draft";

import { buildProductCommand } from "./product-draft";

const base = {
  categoryId: null,
  lowStockThreshold: "2.500",
  name: "Coffee",
  quantityPrecision: 3 as const,
  sellingPrice: "1.25",
  sku: "COF-1",
  tracked: true,
  unitKind: "kilogram" as const,
};

const original = {
  id: "07b5c93e-3374-40e1-956e-c344cd48712a",
  categoryId: null,
  lowStockThresholdMinorUnits: "2500",
  name: "Coffee",
  quantityPrecision: 3 as const,
  sellingPriceCurrency: "USD",
  sellingPriceCurrencyMinorUnitDigits: 2,
  sellingPriceMinorUnits: "125",
  sku: "COF-1",
  status: "active" as const,
  tracked: true,
  unitKind: "kilogram" as const,
  createdAt: "2026-08-22T10:00:00.000Z",
  updatedAt: "2026-08-22T10:00:00.000Z",
};

describe("product draft command", () => {
  test("snapshots no currency client-side and emits exact price/quantity minor units", () => {
    const result = buildProductCommand({
      currencyMinorUnitDigits: 2,
      draft: base,
      idempotencyKey: "00b87f42-09d8-4bcf-9925-2a2c08f12f34",
      mode: "create",
    });
    expect(result).toEqual({
      command: {
        idempotencyKey: "00b87f42-09d8-4bcf-9925-2a2c08f12f34",
        categoryId: null,
        lowStockThresholdMinorUnits: "2500",
        name: "Coffee",
        quantityPrecision: 3,
        sellingPriceMinorUnits: "125",
        sku: "COF-1",
        tracked: true,
        unitKind: "kilogram",
      },
    });
  });

  test("allows a zero selling price and clears threshold when tracking is off", () => {
    const result = buildProductCommand({
      currencyMinorUnitDigits: 0,
      draft: { ...base, sellingPrice: "0", tracked: false },
      idempotencyKey: "c7c4cb5c-d1fb-4c0a-a93f-d6c34907c31e",
      mode: "edit",
    });
    expect(result).toMatchObject({
      command: {
        sellingPriceMinorUnits: "0",
        lowStockThresholdMinorUnits: null,
        tracked: false,
      },
    });
  });

  test("returns field errors instead of a guessed rounded value", () => {
    expect(
      buildProductCommand({
        currencyMinorUnitDigits: 2,
        draft: { ...base, sellingPrice: "1.234" },
        idempotencyKey: "f954eea6-34ff-4b31-8ad7-e1818aa7f40f",
        mode: "create",
      }),
    ).toEqual({ errors: { sellingPrice: "invalid" } });
  });

  test("updates only changed fields so an unchanged archived category is not revalidated", () => {
    expect(
      buildProductCommand({
        currencyMinorUnitDigits: 2,
        draft: { ...base, name: "Coffee premium" },
        idempotencyKey: "9810dcfb-767a-4b66-a018-acb626e83734",
        mode: "edit",
        original,
      }),
    ).toEqual({
      command: {
        idempotencyKey: "9810dcfb-767a-4b66-a018-acb626e83734",
        name: "Coffee premium",
      },
    });
  });

  test("does not create an update receipt when nothing changed", () => {
    expect(
      buildProductCommand({
        currencyMinorUnitDigits: 2,
        draft: base,
        idempotencyKey: "9810dcfb-767a-4b66-a018-acb626e83734",
        mode: "edit",
        original,
      }),
    ).toEqual({ errors: { form: "no-changes" } });
  });

  test.each([
    ["1,500", 3],
    ["2,000", 4],
    ["1,234.56", 2],
    ["1.234,56", 2],
    ["12.", 2],
    ["-1", 2],
    ["1e3", 2],
    ["1.234", 2],
    ["92233720368547758.08", 2],
  ])("rejects %s at exponent %s consistently with sales", (amount, digits) => {
    expect(
      buildProductCommand({
        currencyMinorUnitDigits: digits,
        draft: { ...base, sellingPrice: amount },
        idempotencyKey: "00b87f42-09d8-4bcf-9925-2a2c08f12f34",
        mode: "create",
      }),
    ).toEqual({ errors: { sellingPrice: "invalid" } });
    expect(
      validateSaleDraft({ amount, date: "2026-09-26", time: "12:00", description: "" }, digits)
        .issues.amount,
    ).toBeDefined();
  });

  test.each([
    ["0,001", 3, "1"],
    ["0.0001", 4, "1"],
    ["0012,50", 2, "1250"],
    ["92233720368547758.07", 2, "9223372036854775807"],
    ["45035996273704.97", 2, "4503599627370497"],
  ])("keeps the same exact minor units as sales for %s", (amount, digits, expected) => {
    expect(
      buildProductCommand({
        currencyMinorUnitDigits: digits,
        draft: { ...base, sellingPrice: amount },
        idempotencyKey: "00b87f42-09d8-4bcf-9925-2a2c08f12f34",
        mode: "create",
      }),
    ).toMatchObject({ command: { sellingPriceMinorUnits: expected } });
    expect(
      validateSaleDraft({ amount, date: "2026-09-26", time: "12:00", description: "" }, digits)
        .draft?.grossMinorUnits,
    ).toBe(expected);
  });

  test("preserves an absent price, zero price and clearing an existing price", () => {
    for (const mode of ["create", "edit"] as const) {
      for (const [sellingPrice, expected] of [
        ["  ", null],
        ["0.00", "0"],
      ] as const) {
        expect(
          buildProductCommand({
            currencyMinorUnitDigits: 2,
            draft: { ...base, sellingPrice },
            idempotencyKey: "00b87f42-09d8-4bcf-9925-2a2c08f12f34",
            mode,
            original: mode === "edit" ? original : undefined,
          }),
        ).toMatchObject({ command: { sellingPriceMinorUnits: expected } });
      }
    }
    expect(
      validateSaleDraft({ amount: "0.00", date: "2026-09-26", time: "12:00", description: "" }, 2)
        .draft,
    ).toBeNull();
  });
});
