import {
  archiveSupplierRequestSchema,
  createSupplierRequestSchema,
  supplierSchema,
  updateSupplierRequestSchema,
} from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { beginOperation, fingerprintCommand, saveOperation } from "../operation-log.ts";
import { purchase, supplier } from "../schema/purchases.ts";
import { toSupplier } from "./mappers.ts";
import {
  lockSupplier,
  purchaseBalance,
  purchaseOperationLog,
  supplierPaymentTotals,
} from "./records.ts";
import type { PurchasesRepository } from "./types.ts";

type SupplierCommands = Pick<
  PurchasesRepository,
  "archiveSupplier" | "createSupplier" | "updateSupplier"
>;

export function createSupplierCommands(db: Database): SupplierCommands {
  return {
    async createSupplier(actor, rawCommand) {
      const command = parseInput(
        createSupplierRequestSchema,
        rawCommand,
        "Supplier details are invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "supplier.created";
      const commandFingerprint = await fingerprintCommand(action, payload);
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: purchaseOperationLog,
          permissions: ["purchases:manage"],
          snapshot: supplierSchema,
        });
        if (replay) return { supplier: replay, replayed: true };

        const [record] = await tx
          .insert(supplier)
          .values({
            businessId: access.businessId,
            name: command.name,
            contactName: command.contactName ?? null,
            phone: command.phone ?? null,
            email: command.email ?? null,
            taxId: command.taxId ?? null,
            creditDays: command.creditDays ?? null,
            notes: command.notes ?? null,
          })
          .returning();
        if (!record) throw new Error("Supplier insert returned no record");
        const result = toSupplier(record);
        await saveOperation(tx, purchaseOperationLog, identity, {
          supplierId: result.id,
          resultSnapshot: result,
        });
        return { supplier: result, replayed: false };
      });
    },

    async updateSupplier(actor, supplierId, rawCommand) {
      const command = parseInput(
        updateSupplierRequestSchema,
        rawCommand,
        "Supplier changes are invalid",
      );
      const { idempotencyKey, ...changes } = command;
      const action = "supplier.updated";
      const commandFingerprint = await fingerprintCommand(action, { supplierId, ...changes });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: purchaseOperationLog,
          permissions: ["purchases:manage"],
          snapshot: supplierSchema,
        });
        if (replay) return { supplier: replay, replayed: true };

        const existing = await lockSupplier(tx, access.businessId, supplierId, "update");
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "An archived supplier cannot be changed");
        }
        const [record] = await tx
          .update(supplier)
          .set({
            ...(changes.name !== undefined ? { name: changes.name } : {}),
            ...(changes.contactName !== undefined ? { contactName: changes.contactName } : {}),
            ...(changes.phone !== undefined ? { phone: changes.phone } : {}),
            ...(changes.email !== undefined ? { email: changes.email } : {}),
            ...(changes.taxId !== undefined ? { taxId: changes.taxId } : {}),
            ...(changes.creditDays !== undefined ? { creditDays: changes.creditDays } : {}),
            ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
          })
          .where(and(eq(supplier.businessId, access.businessId), eq(supplier.id, supplierId)))
          .returning();
        if (!record) throw new Error("Supplier update returned no record");
        const result = toSupplier(record);
        await saveOperation(tx, purchaseOperationLog, identity, {
          supplierId,
          resultSnapshot: result,
        });
        return { supplier: result, replayed: false };
      });
    },

    async archiveSupplier(actor, supplierId, rawCommand) {
      const command = parseInput(
        archiveSupplierRequestSchema,
        rawCommand,
        "Supplier archive confirmation is invalid",
      );
      const action = "supplier.archived";
      const commandFingerprint = await fingerprintCommand(action, { supplierId });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: purchaseOperationLog,
          permissions: ["purchases:manage"],
          snapshot: supplierSchema,
        });
        if (replay) return { supplier: replay, replayed: true };

        const existing = await lockSupplier(tx, access.businessId, supplierId, "update");
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "The supplier is already archived");
        }
        // Archived suppliers take no new purchases, so a debt to one would be left unpaid.
        const [debt] = await tx.execute<{ owed: boolean }>(sql`
          select exists (
            select 1
            from ${purchase}
            left join (${supplierPaymentTotals(access.businessId)}) payment_totals
              on payment_totals.purchase_id = ${purchase.id}
            where ${purchase.businessId} = ${access.businessId}
              and ${purchase.supplierId} = ${supplierId}
              and ${purchaseBalance()} > 0
          ) as owed
        `);
        if (!debt) throw new Error("Supplier outstanding-balance query returned no row");
        if (debt.owed) {
          throw new ProductError(
            "CONFLICT",
            "The business still owes this supplier and it cannot be archived",
          );
        }
        const [record] = await tx
          .update(supplier)
          .set({ status: "archived" })
          .where(and(eq(supplier.businessId, access.businessId), eq(supplier.id, supplierId)))
          .returning();
        if (!record) throw new Error("Supplier archive returned no record");
        const result = toSupplier(record);
        await saveOperation(tx, purchaseOperationLog, identity, {
          supplierId,
          resultSnapshot: result,
        });
        return { supplier: result, replayed: false };
      });
    },
  };
}
