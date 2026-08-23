import { describe, expect, test } from "bun:test";

import {
  createProductRequestSchema,
  inventoryMovementSchema,
  productSchema,
  recordInventoryMovementRequestSchema,
  stockListQuerySchema,
  updateProductRequestSchema,
} from "../src/catalog.ts";

const product = {
  id: "1f452631-3f5d-49f7-bc40-b926cfc37c8c",
  categoryId: null,
  name: "Coffee",
  sku: "COF-1",
  sellingPriceMinorUnits: "250",
  sellingPriceCurrency: "USD",
  sellingPriceCurrencyMinorUnitDigits: 2,
  unitKind: "unit",
  quantityPrecision: 0,
  tracked: true,
  lowStockThresholdMinorUnits: "5",
  status: "active",
  createdAt: "2026-08-22T12:00:00.000Z",
  updatedAt: "2026-08-22T12:00:00.000Z",
} as const;

describe("catalog and inventory contracts", () => {
  test("accepts a price only with its immutable business-currency snapshot", () => {
    expect(productSchema.safeParse(product).success).toBe(true);
    expect(
      productSchema.safeParse({
        ...product,
        sellingPriceCurrency: null,
      }).success,
    ).toBe(false);
  });

  test("rejects precision outside V1 and thresholds on untracked products", () => {
    expect(
      createProductRequestSchema.safeParse({
        idempotencyKey: "0c2634a1-b9b7-4844-98d0-fc1fe3b9d08b",
        name: "Flour",
        unitKind: "kilogram",
        quantityPrecision: 4,
        tracked: true,
      }).success,
    ).toBe(false);
    expect(
      createProductRequestSchema.safeParse({
        idempotencyKey: "0c2634a1-b9b7-4844-98d0-fc1fe3b9d08b",
        name: "Consulting",
        unitKind: "unit",
        quantityPrecision: 0,
        tracked: false,
        lowStockThresholdMinorUnits: "1",
      }).success,
    ).toBe(false);
  });

  test("uses strict mutation commands and requires a real update", () => {
    expect(
      updateProductRequestSchema.safeParse({
        idempotencyKey: "c4f4604e-d9ea-449d-a9e5-27437378d2c5",
      }).success,
    ).toBe(false);
    expect(
      updateProductRequestSchema.safeParse({
        idempotencyKey: "c4f4604e-d9ea-449d-a9e5-27437378d2c5",
        name: "Updated coffee",
        businessId: "untrusted-business",
      }).success,
    ).toBe(false);
  });

  test("accepts exact fixed-scale quantities and rejects decimal JSON numbers", () => {
    const command = {
      idempotencyKey: "1b188775-72d0-45f1-97b6-9fe06fc8311c",
      action: "adjust_out",
      quantityMinorUnits: "1250",
      reason: "Damaged stock",
      occurredLocalDate: "2026-08-22",
      occurredLocalTime: "14:30",
    };
    expect(recordInventoryMovementRequestSchema.safeParse(command).success).toBe(true);
    expect(
      recordInventoryMovementRequestSchema.safeParse({ ...command, quantityMinorUnits: 12.5 })
        .success,
    ).toBe(false);
    expect(
      recordInventoryMovementRequestSchema.safeParse({ ...command, quantityMinorUnits: "01" })
        .success,
    ).toBe(false);
  });

  test("represents a reversal without rewriting the original movement", () => {
    expect(
      inventoryMovementSchema.safeParse({
        id: "afad662e-fe6d-4923-a6ef-4897bb8c4b87",
        productId: product.id,
        action: "reverse",
        quantityMinorUnits: "5",
        deltaMinorUnits: "-5",
        quantityPrecision: 0,
        reason: "Duplicate receipt",
        occurredAt: "2026-08-22T20:30:00.000Z",
        occurredLocalDate: "2026-08-22",
        occurredLocalTime: "14:30",
        timeZone: "America/El_Salvador",
        createdByUserId: "user-1",
        reversesMovementId: "69c57a99-d07c-418d-b481-d955090a21e9",
        reversedByMovementId: null,
        createdAt: "2026-08-22T20:31:00.000Z",
      }).success,
    ).toBe(true);
  });

  test("bounds list limits and parses the explicit low-stock filter", () => {
    expect(stockListQuerySchema.parse({ limit: "50", lowStockOnly: "true" })).toEqual({
      limit: 50,
      lowStockOnly: true,
    });
    expect(stockListQuerySchema.parse({ limit: 50, lowStockOnly: true })).toEqual({
      limit: 50,
      lowStockOnly: true,
    });
    expect(stockListQuerySchema.safeParse({ limit: "51" }).success).toBe(false);
    expect(stockListQuerySchema.safeParse({ lowStockOnly: "yes" }).success).toBe(false);
  });
});
