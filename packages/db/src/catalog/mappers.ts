import type { Category, InventoryMovement, Product, ProductStock } from "@pisto/contracts";
import {
  catalogRecordStatusSchema,
  inventoryMovementActionSchema,
  productUnitKindSchema,
} from "@pisto/contracts";

import type { CategoryRecord, MovementRecord, ProductRecord } from "./types.ts";

export function toCategory(record: CategoryRecord): Category {
  return {
    id: record.id,
    name: record.name,
    status: catalogRecordStatusSchema.parse(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toProduct(record: ProductRecord): Product {
  return {
    id: record.id,
    categoryId: record.categoryId,
    name: record.name,
    sku: record.sku,
    sellingPriceMinorUnits: record.sellingPriceMinorUnits?.toString() ?? null,
    sellingPriceCurrency: record.sellingPriceCurrency,
    sellingPriceCurrencyMinorUnitDigits: record.sellingPriceCurrencyMinorUnitDigits,
    unitKind: productUnitKindSchema.parse(record.unitKind),
    quantityPrecision: record.quantityPrecision,
    tracked: record.tracked,
    lowStockThresholdMinorUnits: record.lowStockThresholdMinorUnits?.toString() ?? null,
    status: catalogRecordStatusSchema.parse(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toMovement(
  record: MovementRecord,
  reversedByMovementId: string | null,
): InventoryMovement {
  return {
    id: record.id,
    productId: record.productId,
    action: inventoryMovementActionSchema.parse(record.action),
    quantityMinorUnits: record.quantityMinorUnits.toString(),
    deltaMinorUnits: record.deltaMinorUnits.toString(),
    quantityPrecision: record.quantityPrecision,
    reason: record.reason,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    createdByUserId: record.createdByUserId,
    reversesMovementId: record.reversesMovementId,
    reversedByMovementId,
    createdAt: record.createdAt.toISOString(),
  };
}

export function stockFor(record: ProductRecord, onHandMinorUnits: string): ProductStock | null {
  if (!record.tracked) return null;
  const threshold = record.lowStockThresholdMinorUnits;
  return {
    productId: record.id,
    quantityPrecision: record.quantityPrecision,
    onHandMinorUnits,
    lowStockThresholdMinorUnits: threshold?.toString() ?? null,
    lowStock: threshold !== null && BigInt(onHandMinorUnits) <= threshold,
  };
}

/** A tracked product always has stock state; its absence is a repository fault. */
export function trackedStockFor(record: ProductRecord, onHandMinorUnits: string): ProductStock {
  const stock = stockFor(record, onHandMinorUnits);
  if (!stock) throw new Error("Tracked product did not produce stock state");
  return stock;
}
