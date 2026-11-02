import { and, eq, inArray } from "drizzle-orm";

import type { AuthorizedBusinessContext, DatabaseTransaction } from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { catalogProduct, inventoryMovement } from "../schema/catalog.ts";
import { purchaseLine } from "../schema/purchases.ts";
import { currentBalance } from "./records.ts";
import type { ProductRecord } from "./types.ts";

interface StockOccurrence {
  access: AuthorizedBusinessContext;
  actorUserId: string;
  occurredAt: Date;
  occurredLocalDate: string;
  occurredLocalTime: string;
  /** Trimmed text of 1 to 240 characters that explains the movement in the product history. */
  reason: string;
}

/** A purchase owns its receipt movements: only voiding the purchase may take that stock back. */
export async function isPurchaseReceipt(
  tx: DatabaseTransaction,
  businessId: string,
  movementId: string,
): Promise<boolean> {
  const [line] = await tx
    .select({ id: purchaseLine.id })
    .from(purchaseLine)
    .where(
      and(
        eq(purchaseLine.businessId, businessId),
        eq(purchaseLine.inventoryMovementId, movementId),
      ),
    )
    .limit(1);
  return line !== undefined;
}

/**
 * Locks the products in identifier order, so concurrent stock commands cannot deadlock. A void
 * repairs recorded history, so it may still take stock back from a product archived since.
 */
async function lockProducts(
  tx: DatabaseTransaction,
  businessId: string,
  productIds: readonly string[],
  { allowArchived }: { allowArchived: boolean },
): Promise<Map<string, ProductRecord>> {
  const unique = [...new Set(productIds)];
  const records = await tx
    .select()
    .from(catalogProduct)
    .where(and(eq(catalogProduct.businessId, businessId), inArray(catalogProduct.id, unique)))
    .orderBy(catalogProduct.id)
    .for("update");
  const products = new Map(records.map((record) => [record.id, record]));
  for (const productId of unique) {
    const product = products.get(productId);
    if (!product) throw new ProductError("NOT_FOUND", "Product was not found");
    if (product.status === "archived" && product.tracked && !allowArchived) {
      throw new ProductError("CONFLICT", "Inventory cannot change for an archived product");
    }
  }
  return products;
}

/**
 * Enters received purchase lines into stock. A line of an untracked product moves no stock and
 * gets `null`; the result is aligned with `lines`.
 */
export async function receivePurchaseStock(
  tx: DatabaseTransaction,
  input: StockOccurrence & {
    lines: readonly { productId: string; quantityMinorUnits: bigint; quantityPrecision: number }[];
  },
): Promise<(string | null)[]> {
  const products = await lockProducts(
    tx,
    input.access.businessId,
    input.lines.map(({ productId }) => productId),
    { allowArchived: false },
  );
  const movementIds: (string | null)[] = [];
  for (const line of input.lines) {
    const product = products.get(line.productId);
    if (!product) throw new Error("A locked product is missing");
    if (!product.tracked) {
      movementIds.push(null);
      continue;
    }
    if (product.quantityPrecision !== line.quantityPrecision) {
      throw new ProductError(
        "CONFLICT",
        "The product quantity precision changed after the purchase was recorded",
      );
    }
    const [movement] = await tx
      .insert(inventoryMovement)
      .values({
        action: "receive",
        businessId: input.access.businessId,
        createdByUserId: input.actorUserId,
        deltaMinorUnits: line.quantityMinorUnits,
        occurredAt: input.occurredAt,
        occurredLocalDate: input.occurredLocalDate,
        occurredLocalTime: input.occurredLocalTime,
        productId: product.id,
        quantityMinorUnits: line.quantityMinorUnits,
        quantityPrecision: product.quantityPrecision,
        reason: input.reason,
        timeZone: input.access.timeZone,
      })
      .returning({ id: inventoryMovement.id });
    if (!movement) throw new Error("Purchase stock movement insert returned no record");
    movementIds.push(movement.id);
  }
  return movementIds;
}

/** Takes the stock of a voided purchase back out, one reversal per receipt movement. */
export async function reversePurchaseStock(
  tx: DatabaseTransaction,
  input: StockOccurrence & { movementIds: readonly string[] },
): Promise<void> {
  if (input.movementIds.length === 0) return;
  const originals = await tx
    .select()
    .from(inventoryMovement)
    .where(
      and(
        eq(inventoryMovement.businessId, input.access.businessId),
        inArray(inventoryMovement.id, [...input.movementIds]),
      ),
    );
  if (originals.length !== new Set(input.movementIds).size) {
    throw new Error("A purchase receipt movement is missing");
  }
  await lockProducts(
    tx,
    input.access.businessId,
    originals.map(({ productId }) => productId),
    { allowArchived: true },
  );
  const reversed = await tx
    .select({ id: inventoryMovement.id })
    .from(inventoryMovement)
    .where(
      and(
        eq(inventoryMovement.businessId, input.access.businessId),
        inArray(inventoryMovement.reversesMovementId, [...input.movementIds]),
      ),
    )
    .limit(1);
  if (reversed.length > 0) {
    throw new ProductError("CONFLICT", "The purchase stock was already reversed");
  }
  for (const original of originals) {
    const delta = -original.deltaMinorUnits;
    const nextBalance =
      (await currentBalance(tx, input.access.businessId, original.productId)) + delta;
    if (nextBalance < 0n) {
      throw new ProductError("CONFLICT", "The reversal would make tracked stock negative");
    }
    const [created] = await tx
      .insert(inventoryMovement)
      .values({
        action: "reverse",
        businessId: input.access.businessId,
        createdByUserId: input.actorUserId,
        deltaMinorUnits: delta,
        occurredAt: input.occurredAt,
        occurredLocalDate: input.occurredLocalDate,
        occurredLocalTime: input.occurredLocalTime,
        productId: original.productId,
        quantityMinorUnits: original.quantityMinorUnits,
        quantityPrecision: original.quantityPrecision,
        reason: input.reason,
        reversesMovementId: original.id,
        timeZone: input.access.timeZone,
      })
      .returning({ id: inventoryMovement.id });
    if (!created) throw new Error("Purchase stock reversal insert returned no record");
  }
}
