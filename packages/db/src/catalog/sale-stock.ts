import { and, asc, eq, inArray } from "drizzle-orm";

import type { DatabaseTransaction } from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { catalogProduct, inventoryMovement } from "../schema/catalog.ts";
import { currentBalance } from "./records.ts";
import type { MovementRecord, ProductRecord } from "./types.ts";

/**
 * Catalog's owner port for itemized sales (ADR 0016): the sale command coordinates the
 * transaction, while stock policy and the inventory ledger stay here.
 */

interface SaleOccurrence {
  businessId: string;
  actorUserId: string;
  saleId: string;
  occurredAt: Date;
  occurredLocalDate: string;
  occurredLocalTime: string;
  timeZone: string;
}

/**
 * Locks the products a sale names in identifier order, FOR UPDATE like every stock command, so a
 * concurrent sale or adjustment of the same product waits and then reads the new balance.
 */
async function lockProducts(
  tx: DatabaseTransaction,
  businessId: string,
  productIds: readonly string[],
): Promise<Map<string, ProductRecord>> {
  const records = await tx
    .select()
    .from(catalogProduct)
    .where(
      and(eq(catalogProduct.businessId, businessId), inArray(catalogProduct.id, [...productIds])),
    )
    .orderBy(asc(catalogProduct.id))
    .for("update");
  return new Map(records.map((record) => [record.id, record]));
}

/** The active products a new sale charges, locked for the rest of the transaction. */
export async function lockSaleProducts(
  tx: DatabaseTransaction,
  businessId: string,
  productIds: readonly string[],
): Promise<Map<string, ProductRecord>> {
  const products = await lockProducts(tx, businessId, productIds);
  for (const productId of productIds) {
    const product = products.get(productId);
    if (!product) throw new ProductError("NOT_FOUND", "Product was not found");
    if (product.status !== "active") {
      throw new ProductError("CONFLICT", "An archived product cannot be sold");
    }
  }
  return products;
}

/** Takes each tracked line out of stock; an untracked product has no ledger to change. */
export async function takeSaleStock(
  tx: DatabaseTransaction,
  sale: SaleOccurrence,
  lines: readonly { product: ProductRecord; quantityMinorUnits: bigint }[],
): Promise<MovementRecord[]> {
  const movements: MovementRecord[] = [];
  for (const { product, quantityMinorUnits } of lines) {
    if (!product.tracked) continue;
    const onHand = await currentBalance(tx, sale.businessId, product.id);
    if (onHand < quantityMinorUnits) {
      throw new ProductError("CONFLICT", "There is not enough stock for this sale");
    }
    const [created] = await tx
      .insert(inventoryMovement)
      .values({
        action: "sale",
        businessId: sale.businessId,
        createdByUserId: sale.actorUserId,
        deltaMinorUnits: -quantityMinorUnits,
        occurredAt: sale.occurredAt,
        occurredLocalDate: sale.occurredLocalDate,
        occurredLocalTime: sale.occurredLocalTime,
        productId: product.id,
        quantityMinorUnits,
        quantityPrecision: product.quantityPrecision,
        reason: null,
        saleId: sale.saleId,
        timeZone: sale.timeZone,
      })
      .returning();
    if (!created) throw new Error("Sale stock movement insert returned no record");
    movements.push(created);
  }
  return movements;
}

/**
 * Returns a voided sale's stock with one reversal per sale movement. It also applies to a product
 * archived since the sale: voiding must undo the whole sale, and stock only grows.
 */
export async function returnSaleStock(
  tx: DatabaseTransaction,
  sale: SaleOccurrence & { reason: string },
): Promise<MovementRecord[]> {
  const originals = await tx
    .select()
    .from(inventoryMovement)
    .where(
      and(
        eq(inventoryMovement.businessId, sale.businessId),
        eq(inventoryMovement.saleId, sale.saleId),
        eq(inventoryMovement.action, "sale"),
      ),
    )
    .orderBy(asc(inventoryMovement.productId));
  if (originals.length === 0) return [];
  await lockProducts(
    tx,
    sale.businessId,
    originals.map(({ productId }) => productId),
  );
  const reversals: MovementRecord[] = [];
  for (const original of originals) {
    const [created] = await tx
      .insert(inventoryMovement)
      .values({
        action: "reverse",
        businessId: sale.businessId,
        createdByUserId: sale.actorUserId,
        deltaMinorUnits: -original.deltaMinorUnits,
        occurredAt: sale.occurredAt,
        occurredLocalDate: sale.occurredLocalDate,
        occurredLocalTime: sale.occurredLocalTime,
        productId: original.productId,
        quantityMinorUnits: original.quantityMinorUnits,
        quantityPrecision: original.quantityPrecision,
        reason: sale.reason,
        reversesMovementId: original.id,
        timeZone: sale.timeZone,
      })
      .returning();
    if (!created) throw new Error("Sale stock reversal insert returned no record");
    reversals.push(created);
  }
  return reversals;
}
