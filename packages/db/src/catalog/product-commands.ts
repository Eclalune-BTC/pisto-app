import {
  archiveProductRequestSchema,
  createProductRequestSchema,
  productMutationResponseSchema,
  updateProductRequestSchema,
} from "@pisto/contracts";
import { and, eq, ne, sql } from "drizzle-orm";

import type { DatabaseTransaction } from "../business-access.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { parseMinorUnits } from "../money.ts";
import {
  beginOperation,
  fingerprintCommand,
  lockSemanticKey,
  saveOperation,
} from "../operation-log.ts";
import { catalogProduct, inventoryMovement } from "../schema/catalog.ts";
import { toProduct } from "./mappers.ts";
import { catalogOperationLog, requireActiveCategory } from "./records.ts";
import type { ProductCommands } from "./types.ts";

const productSnapshotSchema = productMutationResponseSchema.shape.data.omit({ replayed: true });

function normalizeSku(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function parseOptionalAmount(value: string | null, label: string): bigint | null {
  return value === null ? null : parseMinorUnits(value, label, { allowZero: true });
}

async function requireUniqueSku(
  tx: DatabaseTransaction,
  businessId: string,
  sku: string,
  exceptId?: string,
): Promise<void> {
  await lockSemanticKey(tx, "product-sku", businessId, sku);
  const [duplicate] = await tx
    .select({ id: catalogProduct.id })
    .from(catalogProduct)
    .where(
      and(
        eq(catalogProduct.businessId, businessId),
        exceptId === undefined ? undefined : ne(catalogProduct.id, exceptId),
        sql`lower(${catalogProduct.sku}) = lower(${sku})`,
      ),
    )
    .limit(1);
  if (duplicate) throw new ProductError("CONFLICT", "A product with that SKU already exists");
}

async function lockExistingProduct(tx: DatabaseTransaction, businessId: string, id: string) {
  const [existing] = await tx
    .select()
    .from(catalogProduct)
    .where(and(eq(catalogProduct.businessId, businessId), eq(catalogProduct.id, id)))
    .limit(1)
    .for("update");
  if (!existing) throw new ProductError("NOT_FOUND", "Product was not found");
  return existing;
}

export function createProductCommands(db: Database): ProductCommands {
  return {
    async createProduct(actor, rawCommand) {
      const command = parseInput(
        createProductRequestSchema,
        rawCommand,
        "Product command is invalid",
      );
      const normalizedSku = normalizeSku(command.sku);
      const action = "product.created";
      const commandFingerprint = await fingerprintCommand(action, {
        categoryId: command.categoryId ?? null,
        lowStockThresholdMinorUnits: command.lowStockThresholdMinorUnits ?? null,
        name: command.name,
        quantityPrecision: command.quantityPrecision,
        sellingPriceMinorUnits: command.sellingPriceMinorUnits ?? null,
        sku: normalizedSku,
        tracked: command.tracked,
        unitKind: command.unitKind,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: catalogOperationLog,
          permissions: ["catalog:manage"],
          snapshot: productSnapshotSchema,
        });
        if (replay) return { ...replay, replayed: true };
        if (command.categoryId) {
          await requireActiveCategory(tx, access.businessId, command.categoryId);
        }
        if (normalizedSku) await requireUniqueSku(tx, access.businessId, normalizedSku);
        const sellingPrice = parseOptionalAmount(
          command.sellingPriceMinorUnits ?? null,
          "Selling price",
        );
        const lowStockThreshold = parseOptionalAmount(
          command.lowStockThresholdMinorUnits ?? null,
          "Low-stock threshold",
        );
        const [created] = await tx
          .insert(catalogProduct)
          .values({
            businessId: access.businessId,
            categoryId: command.categoryId ?? null,
            lowStockThresholdMinorUnits: command.tracked ? lowStockThreshold : null,
            name: command.name,
            quantityPrecision: command.quantityPrecision,
            sellingPriceCurrency: sellingPrice === null ? null : access.currency,
            sellingPriceCurrencyMinorUnitDigits:
              sellingPrice === null ? null : access.currencyMinorUnitDigits,
            sellingPriceMinorUnits: sellingPrice,
            sku: normalizedSku,
            tracked: command.tracked,
            unitKind: command.unitKind,
          })
          .returning();
        if (!created) throw new Error("Product insert returned no record");
        const product = toProduct(created);
        await saveOperation(tx, catalogOperationLog, identity, {
          productId: product.id,
          resultSnapshot: { product },
        });
        return { product, replayed: false };
      });
    },

    async updateProduct(actor, productId, rawCommand) {
      const command = parseInput(
        updateProductRequestSchema,
        rawCommand,
        "Product command is invalid",
      );
      const normalizedSku = command.sku === undefined ? undefined : normalizeSku(command.sku);
      const action = "product.updated";
      const commandFingerprint = await fingerprintCommand(action, {
        productId,
        categoryId: command.categoryId,
        lowStockThresholdMinorUnits: command.lowStockThresholdMinorUnits,
        name: command.name,
        quantityPrecision: command.quantityPrecision,
        sellingPriceMinorUnits: command.sellingPriceMinorUnits,
        sku: normalizedSku,
        tracked: command.tracked,
        unitKind: command.unitKind,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: catalogOperationLog,
          permissions: ["catalog:manage"],
          snapshot: productSnapshotSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const existing = await lockExistingProduct(tx, access.businessId, productId);
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "An archived product cannot be updated");
        }
        if (command.categoryId) {
          await requireActiveCategory(tx, access.businessId, command.categoryId);
        }
        if (normalizedSku) await requireUniqueSku(tx, access.businessId, normalizedSku, productId);
        const precisionChanges =
          command.quantityPrecision !== undefined &&
          command.quantityPrecision !== existing.quantityPrecision;
        const disablesTracking = command.tracked === false && existing.tracked;
        const unitChanges =
          command.unitKind !== undefined && command.unitKind !== existing.unitKind;
        if (precisionChanges || disablesTracking || unitChanges) {
          const [movement] = await tx
            .select({ id: inventoryMovement.id })
            .from(inventoryMovement)
            .where(
              and(
                eq(inventoryMovement.businessId, access.businessId),
                eq(inventoryMovement.productId, productId),
              ),
            )
            .limit(1);
          if (movement) {
            throw new ProductError(
              "CONFLICT",
              unitChanges
                ? "Quantity unit cannot change after inventory history exists"
                : precisionChanges
                  ? "Quantity precision cannot change after inventory history exists"
                  : "Inventory tracking cannot be disabled after inventory history exists",
            );
          }
        }
        const sellingPrice =
          command.sellingPriceMinorUnits === undefined
            ? undefined
            : parseOptionalAmount(command.sellingPriceMinorUnits, "Selling price");
        const lowStockThreshold =
          command.lowStockThresholdMinorUnits === undefined
            ? undefined
            : parseOptionalAmount(command.lowStockThresholdMinorUnits, "Low-stock threshold");
        const nextTracked = command.tracked ?? existing.tracked;
        const [updated] = await tx
          .update(catalogProduct)
          .set({
            ...(command.categoryId !== undefined ? { categoryId: command.categoryId } : {}),
            ...(command.name !== undefined ? { name: command.name } : {}),
            ...(command.quantityPrecision !== undefined
              ? { quantityPrecision: command.quantityPrecision }
              : {}),
            ...(command.tracked !== undefined ? { tracked: command.tracked } : {}),
            ...(command.unitKind !== undefined ? { unitKind: command.unitKind } : {}),
            ...(normalizedSku !== undefined ? { sku: normalizedSku } : {}),
            ...(sellingPrice !== undefined
              ? {
                  sellingPriceMinorUnits: sellingPrice,
                  sellingPriceCurrency: sellingPrice === null ? null : access.currency,
                  sellingPriceCurrencyMinorUnitDigits:
                    sellingPrice === null ? null : access.currencyMinorUnitDigits,
                }
              : {}),
            ...(lowStockThreshold !== undefined
              ? { lowStockThresholdMinorUnits: nextTracked ? lowStockThreshold : null }
              : command.tracked === false
                ? { lowStockThresholdMinorUnits: null }
                : {}),
          })
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .returning();
        if (!updated) throw new Error("Product update returned no record");
        const product = toProduct(updated);
        await saveOperation(tx, catalogOperationLog, identity, {
          productId,
          resultSnapshot: { product },
        });
        return { product, replayed: false };
      });
    },

    async archiveProduct(actor, productId, rawCommand) {
      const command = parseInput(
        archiveProductRequestSchema,
        rawCommand,
        "Product command is invalid",
      );
      const action = "product.archived";
      const commandFingerprint = await fingerprintCommand(action, { productId });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: catalogOperationLog,
          permissions: ["catalog:manage"],
          snapshot: productSnapshotSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const existing = await lockExistingProduct(tx, access.businessId, productId);
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "The product is already archived");
        }
        const [updated] = await tx
          .update(catalogProduct)
          .set({ status: "archived" })
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .returning();
        if (!updated) throw new Error("Product archive returned no record");
        const product = toProduct(updated);
        await saveOperation(tx, catalogOperationLog, identity, {
          productId,
          resultSnapshot: { product },
        });
        return { product, replayed: false };
      });
    },
  };
}
