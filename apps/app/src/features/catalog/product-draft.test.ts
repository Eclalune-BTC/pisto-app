import { describe, expect, test } from "vitest";

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
});
