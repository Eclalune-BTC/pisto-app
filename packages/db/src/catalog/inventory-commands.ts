import {
  inventoryMutationResponseSchema,
  recordInventoryMovementRequestSchema,
  reverseInventoryMovementRequestSchema,
} from "@pisto/contracts";
import { and, eq } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { parseMinorUnits } from "../money.ts";
import { beginOperation, fingerprintCommand, saveOperation } from "../operation-log.ts";
import { catalogProduct, inventoryMovement } from "../schema/catalog.ts";
import { toMovement, trackedStockFor } from "./mappers.ts";
import { isPurchaseReceipt } from "./purchase-stock.ts";
import { catalogOperationLog, currentBalance } from "./records.ts";
import type { InventoryCommands } from "./types.ts";

const movementSnapshotSchema = inventoryMutationResponseSchema.shape.data.omit({ replayed: true });

export function createInventoryCommands(db: Database): InventoryCommands {
  return {
    async recordMovement(actor, productId, rawCommand) {
      const command = parseInput(
        recordInventoryMovementRequestSchema,
        rawCommand,
        "Movement command is invalid",
      );
      const action = `inventory.${command.action}` as const;
      const commandFingerprint = await fingerprintCommand(action, {
        productId,
        action: command.action,
        quantityMinorUnits: command.quantityMinorUnits,
        reason: command.reason,
        occurredLocalDate: command.occurredLocalDate,
        occurredLocalTime: command.occurredLocalTime,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: catalogOperationLog,
          permissions: ["inventory:manage"],
          snapshot: movementSnapshotSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const [product] = await tx
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
        const quantity = parseMinorUnits(command.quantityMinorUnits, "Movement quantity", {
          allowZero: false,
        });
        const delta = command.action === "adjust_out" ? -quantity : quantity;
        const nextBalance = (await currentBalance(tx, access.businessId, productId)) + delta;
        if (nextBalance < 0n) {
          throw new ProductError("CONFLICT", "The movement would make tracked stock negative");
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [created] = await tx
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
        const stock = trackedStockFor(product, nextBalance.toString());
        await saveOperation(tx, catalogOperationLog, identity, {
          movementId: movement.id,
          productId,
          resultSnapshot: { movement, stock },
        });
        return { movement, stock, replayed: false };
      });
    },

    async reverseMovement(actor, movementId, rawCommand) {
      const command = parseInput(
        reverseInventoryMovementRequestSchema,
        rawCommand,
        "Reversal command is invalid",
      );
      const action = "inventory.reverse";
      const commandFingerprint = await fingerprintCommand(action, {
        movementId,
        reason: command.reason,
        occurredLocalDate: command.occurredLocalDate,
        occurredLocalTime: command.occurredLocalTime,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: catalogOperationLog,
          permissions: ["inventory:manage"],
          snapshot: movementSnapshotSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const [initial] = await tx
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
        const [product] = await tx
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
        const [original] = await tx
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
        if (await isPurchaseReceipt(tx, access.businessId, original.id)) {
          throw new ProductError("CONFLICT", "Void the purchase to take its received stock back");
        }
        const [existingReversal] = await tx
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
        const delta = -original.deltaMinorUnits;
        const nextBalance = (await currentBalance(tx, access.businessId, product.id)) + delta;
        if (nextBalance < 0n) {
          throw new ProductError("CONFLICT", "The reversal would make tracked stock negative");
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [created] = await tx
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
        const stock = trackedStockFor(product, nextBalance.toString());
        await saveOperation(tx, catalogOperationLog, identity, {
          movementId: movement.id,
          productId: product.id,
          resultSnapshot: { movement, stock },
        });
        return { movement, stock, replayed: false };
      });
    },
  };
}
