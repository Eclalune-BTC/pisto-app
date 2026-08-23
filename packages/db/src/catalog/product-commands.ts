import {
  archiveProductRequestSchema,
  createProductRequestSchema,
  productMutationResponseSchema,
  updateProductRequestSchema,
} from "@pisto/contracts";
import { and, eq, ne, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError } from "../product.ts";
import { catalogProduct, inventoryMovement } from "../schema/catalog.ts";
import { authorizeCatalogAction } from "./access.ts";
import {
  fingerprint,
  normalizeSku,
  parseMutationReplay,
  parseQuantity,
  recordSnapshot,
  toProduct,
} from "./codec.ts";
import {
  lockOperation,
  lockSemanticKey,
  requireActiveCategory,
  saveOperation,
} from "./operations.ts";
import type { ProductCommands } from "./types.ts";

export function createProductCommands(db: Database): ProductCommands {
  return {
    async createProduct(actor, inputCommand) {
      const parsed = createProductRequestSchema.safeParse(inputCommand);
      if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Product command is invalid");
      const command = parsed.data;
      const normalizedSku = normalizeSku(command.sku);
      const action = "product.created" as const;
      const commandFingerprint = await fingerprint(action, {
        categoryId: command.categoryId ?? null,
        lowStockThresholdMinorUnits: command.lowStockThresholdMinorUnits ?? null,
        name: command.name,
        quantityPrecision: command.quantityPrecision,
        sellingPriceMinorUnits: command.sellingPriceMinorUnits ?? null,
        sku: normalizedSku,
        tracked: command.tracked,
        unitKind: command.unitKind,
      });
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:manage", "update");
        const replay = await lockOperation(
          transaction,
          actor,
          access.businessId,
          command.idempotencyKey,
          commandFingerprint,
        );
        if (replay) return parseMutationReplay(productMutationResponseSchema.shape.data, replay);
        if (command.categoryId) {
          await requireActiveCategory(transaction, access.businessId, command.categoryId);
        }
        if (normalizedSku) {
          await lockSemanticKey(transaction, "product-sku", access.businessId, normalizedSku);
          const [duplicate] = await transaction
            .select({ id: catalogProduct.id })
            .from(catalogProduct)
            .where(
              and(
                eq(catalogProduct.businessId, access.businessId),
                sql`lower(${catalogProduct.sku}) = lower(${normalizedSku})`,
              ),
            )
            .limit(1);
          if (duplicate)
            throw new ProductError("CONFLICT", "A product with that SKU already exists");
        }
        const sellingPrice =
          command.sellingPriceMinorUnits == null
            ? null
            : parseQuantity(command.sellingPriceMinorUnits, "Selling price", true);
        const lowStockThreshold =
          command.lowStockThresholdMinorUnits == null
            ? null
            : parseQuantity(command.lowStockThresholdMinorUnits, "Low-stock threshold", true);
        const [created] = await transaction
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
        await saveOperation(transaction, {
          action,
          actor,
          businessId: access.businessId,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          productId: product.id,
          resultSnapshot: recordSnapshot({ product }),
        });
        return { product, replayed: false };
      });
    },

    async updateProduct(actor, productId, inputCommand) {
      const parsed = updateProductRequestSchema.safeParse(inputCommand);
      if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Product command is invalid");
      const command = parsed.data;
      const normalizedSku = command.sku === undefined ? undefined : normalizeSku(command.sku);
      const action = "product.updated" as const;
      const commandFingerprint = await fingerprint(action, {
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
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:manage", "update");
        const replay = await lockOperation(
          transaction,
          actor,
          access.businessId,
          command.idempotencyKey,
          commandFingerprint,
        );
        if (replay) return parseMutationReplay(productMutationResponseSchema.shape.data, replay);
        const [existing] = await transaction
          .select()
          .from(catalogProduct)
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .limit(1)
          .for("update");
        if (!existing) throw new ProductError("NOT_FOUND", "Product was not found");
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "An archived product cannot be updated");
        }
        if (command.categoryId) {
          await requireActiveCategory(transaction, access.businessId, command.categoryId);
        }
        if (normalizedSku) {
          await lockSemanticKey(transaction, "product-sku", access.businessId, normalizedSku);
          const [duplicate] = await transaction
            .select({ id: catalogProduct.id })
            .from(catalogProduct)
            .where(
              and(
                eq(catalogProduct.businessId, access.businessId),
                ne(catalogProduct.id, productId),
                sql`lower(${catalogProduct.sku}) = lower(${normalizedSku})`,
              ),
            )
            .limit(1);
          if (duplicate)
            throw new ProductError("CONFLICT", "A product with that SKU already exists");
        }
        const precisionChanges =
          command.quantityPrecision !== undefined &&
          command.quantityPrecision !== existing.quantityPrecision;
        const disablesTracking = command.tracked === false && existing.tracked;
        if (precisionChanges || disablesTracking) {
          const [movement] = await transaction
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
              precisionChanges
                ? "Quantity precision cannot change after inventory history exists"
                : "Inventory tracking cannot be disabled after inventory history exists",
            );
          }
        }
        const sellingPrice =
          command.sellingPriceMinorUnits === undefined
            ? undefined
            : command.sellingPriceMinorUnits === null
              ? null
              : parseQuantity(command.sellingPriceMinorUnits, "Selling price", true);
        const lowStockThreshold =
          command.lowStockThresholdMinorUnits === undefined
            ? undefined
            : command.lowStockThresholdMinorUnits === null
              ? null
              : parseQuantity(command.lowStockThresholdMinorUnits, "Low-stock threshold", true);
        const nextTracked = command.tracked ?? existing.tracked;
        const [updated] = await transaction
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
            updatedAt: new Date(),
          })
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .returning();
        if (!updated) throw new Error("Product update returned no record");
        const product = toProduct(updated);
        await saveOperation(transaction, {
          action,
          actor,
          businessId: access.businessId,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          productId,
          resultSnapshot: recordSnapshot({ product }),
        });
        return { product, replayed: false };
      });
    },

    async archiveProduct(actor, productId, inputCommand) {
      const parsed = archiveProductRequestSchema.safeParse(inputCommand);
      if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Product command is invalid");
      const command = parsed.data;
      const action = "product.archived" as const;
      const commandFingerprint = await fingerprint(action, { productId });
      return db.transaction(async (transaction) => {
        const access = await authorizeCatalogAction(transaction, actor, "catalog:manage", "update");
        const replay = await lockOperation(
          transaction,
          actor,
          access.businessId,
          command.idempotencyKey,
          commandFingerprint,
        );
        if (replay) return parseMutationReplay(productMutationResponseSchema.shape.data, replay);
        const [existing] = await transaction
          .select()
          .from(catalogProduct)
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .limit(1)
          .for("update");
        if (!existing) throw new ProductError("NOT_FOUND", "Product was not found");
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "The product is already archived");
        }
        const [updated] = await transaction
          .update(catalogProduct)
          .set({ status: "archived", updatedAt: new Date() })
          .where(eq(catalogProduct.id, productId))
          .returning();
        if (!updated) throw new Error("Product archive returned no record");
        const product = toProduct(updated);
        await saveOperation(transaction, {
          action,
          actor,
          businessId: access.businessId,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          productId,
          resultSnapshot: recordSnapshot({ product }),
        });
        return { product, replayed: false };
      });
    },
  };
}
