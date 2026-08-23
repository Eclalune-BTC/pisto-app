import type { Category, InventoryMovement, Product, ProductStock } from "@pisto/contracts";
import { and, eq, lt, or } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { z } from "zod";

import { fingerprintCommand, maximumMinorUnits } from "../operation-log.ts";
import { ProductError } from "../product.ts";
import type {
  CategoryRecord,
  CursorKind,
  MovementRecord,
  OperationAction,
  ProductRecord,
} from "./types.ts";

const cursorPayloadSchema = z.object({
  createdAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
  kind: z.enum(["category", "product", "movement", "stock"]),
});

export function toCategory(record: CategoryRecord): Category {
  return {
    id: record.id,
    name: record.name,
    status: record.status === "archived" ? "archived" : "active",
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
    unitKind: productUnitKind(record.unitKind),
    quantityPrecision: record.quantityPrecision,
    tracked: record.tracked,
    lowStockThresholdMinorUnits: record.lowStockThresholdMinorUnits?.toString() ?? null,
    status: record.status === "archived" ? "archived" : "active",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function productUnitKind(value: string): Product["unitKind"] {
  if (
    value === "unit" ||
    value === "kilogram" ||
    value === "gram" ||
    value === "liter" ||
    value === "milliliter" ||
    value === "meter"
  ) {
    return value;
  }
  throw new Error("Stored product unit kind is invalid");
}

export function toMovement(
  record: MovementRecord,
  reversedByMovementId: string | null,
): InventoryMovement {
  const action =
    record.action === "receive" ||
    record.action === "adjust_in" ||
    record.action === "adjust_out" ||
    record.action === "reverse"
      ? record.action
      : null;
  if (!action) throw new Error("Stored inventory action is invalid");
  return {
    id: record.id,
    productId: record.productId,
    action,
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

export function parseQuantity(value: string, label: string, allowZero: boolean): bigint {
  if (!/^(?:0|[1-9]\d{0,18})$/.test(value)) {
    throw new ProductError("VALIDATION_ERROR", `${label} must be a canonical integer`);
  }
  const parsed = BigInt(value);
  if (parsed > maximumMinorUnits || (!allowZero && parsed === 0n)) {
    throw new ProductError("VALIDATION_ERROR", `${label} is outside the supported range`);
  }
  return parsed;
}

export function normalizeSku(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export function fingerprint(action: OperationAction, payload: unknown): Promise<string> {
  return fingerprintCommand(action, payload);
}

export function recordSnapshot(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

function encodeCursor(kind: CursorKind, record: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ kind, createdAt: record.createdAt.toISOString(), id: record.id }),
  ).toString("base64url");
}

export function decodeCursor(
  cursor: string | undefined,
  kind: CursorKind,
): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const payload = cursorPayloadSchema.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    if (payload.kind !== kind) throw new Error("Cursor kind mismatch");
    return { createdAt: new Date(payload.createdAt), id: payload.id };
  } catch {
    throw new ProductError("VALIDATION_ERROR", "The pagination cursor is invalid");
  }
}

export function pageRows<T extends { createdAt: Date; id: string }>(
  rows: T[],
  limit: number,
  kind: CursorKind,
): { rows: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const selected = hasMore ? rows.slice(0, limit) : rows;
  const last = selected.at(-1);
  return {
    rows: selected,
    nextCursor: hasMore && last ? encodeCursor(kind, last) : null,
  };
}

export function cursorCondition(
  column: { createdAt: AnyPgColumn; id: AnyPgColumn },
  cursor: { createdAt: Date; id: string } | null,
) {
  if (!cursor) return undefined;
  return or(
    lt(column.createdAt, cursor.createdAt),
    and(eq(column.createdAt, cursor.createdAt), lt(column.id, cursor.id)),
  );
}

export function parseMutationReplay<T>(
  schema: { parse(value: unknown): T },
  snapshot: Record<string, unknown>,
): T {
  try {
    return schema.parse({ ...snapshot, replayed: true });
  } catch {
    throw new Error("Stored operation result does not match the catalog contract");
  }
}
