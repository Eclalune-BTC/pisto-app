import {
  inventoryMutationResponseSchema,
  recordInventoryMovementRequestSchema,
  reverseInventoryMovementRequestSchema,
} from "@pisto/contracts";
import { and, eq } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError, resolveLocalDateTime } from "../product.ts";
import { catalogProduct, inventoryMovement } from "../schema/catalog.ts";
import {
  fingerprint,
  parseMutationReplay,
  parseQuantity,
  recordSnapshot,
  stockFor,
  toMovement,
} from "./codec.ts";
import { beginCatalogOperation, currentBalance, saveOperation } from "./operations.ts";
import type { InventoryCommands } from "./types.ts";

export function createInventoryCommands(db: Database): InventoryCommands {
  return {
    async recordMovement(actor, productId, inputCommand) {
      const parsed = recordInventoryMovementRequestSchema.safeParse(inputCommand);
      if (!parsed.success)
        throw new ProductError("VALIDATION_ERROR", "Movement command is invalid");
      const command = parsed.data;
      const action = `inventory.${command.action}` as const;
      const commandFingerprint = await fingerprint(action, {
        productId,
        action: command.action,
        quantityMinorUnits: command.quantityMinorUnits,
        reason: command.reason,
        occurredLocalDate: command.occurredLocalDate,
        occurredLocalTime: command.occurredLocalTime,
      });
      return db.transaction(async (transaction) => {
        const { access, identity, replay } = await beginCatalogOperation(
          transaction,
          actor,
          "inventory:manage",
          { action, commandFingerprint, idempotencyKey: command.idempotencyKey },
        );
        if (replay) return parseMutationReplay(inventoryMutationResponseSchema.shape.data, replay);
        const [product] = await transaction
          .select()
          .from(catalogProduct)
          .where(
            and(eq(catalogProduct.businessId, access.businessId), eq(catalogProduct.id, productId)),
          )
          .limit(1)
          .for("update");
        if (!product) throw new ProductError("NOT_FOUND", "Product was not found");
        if (product.status === "archived") {
          throw new ProductError("CONFLICT", "Inventory cannot change for an archived product");
        }
        if (!product.tracked) {
          throw new ProductError("CONFLICT", "Inventory is not tracked for this product");
        }
        const quantity = parseQuantity(command.quantityMinorUnits, "Movement quantity", false);
        const delta = command.action === "adjust_out" ? -quantity : quantity;
        const balance = await currentBalance(transaction, access.businessId, productId);
        const nextBalance = balance + delta;
        if (nextBalance < 0n) {
          throw new ProductError("CONFLICT", "The movement would make tracked stock negative");
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [created] = await transaction
          .insert(inventoryMovement)
          .values({
            action: command.action,
            businessId: access.businessId,
            createdByUserId: actor.userId,
            deltaMinorUnits: delta,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            productId,
            quantityMinorUnits: quantity,
            quantityPrecision: product.quantityPrecision,
            reason: command.reason,
            timeZone: access.timeZone,
          })
          .returning();
        if (!created) throw new Error("Inventory movement insert returned no record");
        const movement = toMovement(created, null);
        const stock = stockFor(product, nextBalance.toString());
        if (!stock) throw new Error("Tracked product did not produce stock state");
        await saveOperation(transaction, identity, {
          movementId: movement.id,
          productId,
          resultSnapshot: recordSnapshot({ movement, stock }),
        });
        return { movement, stock, replayed: false };
      });
    },

    async reverseMovement(actor, movementId, inputCommand) {
      const parsed = reverseInventoryMovementRequestSchema.safeParse(inputCommand);
      if (!parsed.success)
        throw new ProductError("VALIDATION_ERROR", "Reversal command is invalid");
      const command = parsed.data;
      const action = "inventory.reverse" as const;
      const commandFingerprint = await fingerprint(action, {
        movementId,
        reason: command.reason,
        occurredLocalDate: command.occurredLocalDate,
        occurredLocalTime: command.occurredLocalTime,
      });
      return db.transaction(async (transaction) => {
        const { access, identity, replay } = await beginCatalogOperation(
          transaction,
          actor,
          "inventory:manage",
          { action, commandFingerprint, idempotencyKey: command.idempotencyKey },
        );
        if (replay) return parseMutationReplay(inventoryMutationResponseSchema.shape.data, replay);
        const [initial] = await transaction
          .select({ productId: inventoryMovement.productId })
          .from(inventoryMovement)
          .where(
            and(
              eq(inventoryMovement.businessId, access.businessId),
              eq(inventoryMovement.id, movementId),
            ),
          )
          .limit(1);
        if (!initial) throw new ProductError("NOT_FOUND", "Inventory movement was not found");
        const [product] = await transaction
          .select()
          .from(catalogProduct)
          .where(
            and(
              eq(catalogProduct.businessId, access.businessId),
              eq(catalogProduct.id, initial.productId),
            ),
          )
          .limit(1)
          .for("update");
        if (!product) throw new ProductError("NOT_FOUND", "Product was not found");
        if (product.status === "archived") {
          throw new ProductError("CONFLICT", "Inventory cannot change for an archived product");
        }
        const [original] = await transaction
          .select()
          .from(inventoryMovement)
          .where(
            and(
              eq(inventoryMovement.businessId, access.businessId),
              eq(inventoryMovement.productId, product.id),
              eq(inventoryMovement.id, movementId),
            ),
          )
          .limit(1);
        if (!original) throw new ProductError("NOT_FOUND", "Inventory movement was not found");
        if (original.action === "reverse") {
          throw new ProductError("CONFLICT", "A reversal movement cannot itself be reversed");
        }
        const [existingReversal] = await transaction
          .select({ id: inventoryMovement.id })
          .from(inventoryMovement)
          .where(
            and(
              eq(inventoryMovement.businessId, access.businessId),
              eq(inventoryMovement.reversesMovementId, original.id),
            ),
          )
          .limit(1);
        if (existingReversal) {
          throw new ProductError("CONFLICT", "The inventory movement was already reversed");
        }
        const balance = await currentBalance(transaction, access.businessId, product.id);
        const delta = -original.deltaMinorUnits;
        const nextBalance = balance + delta;
        if (nextBalance < 0n) {
          throw new ProductError("CONFLICT", "The reversal would make tracked stock negative");
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [created] = await transaction
          .insert(inventoryMovement)
          .values({
            action: "reverse",
            businessId: access.businessId,
            createdByUserId: actor.userId,
            deltaMinorUnits: delta,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            productId: product.id,
            quantityMinorUnits: original.quantityMinorUnits,
            quantityPrecision: original.quantityPrecision,
            reason: command.reason,
            reversesMovementId: original.id,
            timeZone: access.timeZone,
          })
          .returning();
        if (!created) throw new Error("Inventory reversal insert returned no record");
        const movement = toMovement(created, null);
        const stock = stockFor(product, nextBalance.toString());
        if (!stock) throw new Error("Tracked product did not produce stock state");
        await saveOperation(transaction, identity, {
          movementId: movement.id,
          productId: product.id,
          resultSnapshot: recordSnapshot({ movement, stock }),
        });
        return { movement, stock, replayed: false };
      });
    },
  };
}
