import {
  archiveCustomerRequestSchema,
  createCustomerRequestSchema,
  customerSchema,
  updateCustomerRequestSchema,
} from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError } from "../product.ts";
import { customer, receivable, receivablePayment } from "../schema/receivables.ts";
import { beginReceivableOperation, insertOperation } from "./access.ts";
import { commandFingerprint, uuidPattern, validate } from "./codec.ts";
import { toCustomer } from "./mappers.ts";
import type { ReceivablesRepository } from "./types.ts";

type CustomerCommands = Pick<
  ReceivablesRepository,
  "archiveCustomer" | "createCustomer" | "updateCustomer"
>;

export function createCustomerCommands(db: Database): CustomerCommands {
  return {
    async createCustomer(actor, rawCommand) {
      const command = validate(
        createCustomerRequestSchema,
        rawCommand,
        "Customer details are invalid",
      );
      const action = "customer.created";
      const fingerprint = await commandFingerprint(action, {
        email: command.email ?? null,
        name: command.name,
        notes: command.notes ?? null,
        phone: command.phone ?? null,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginReceivableOperation(
          tx,
          actor,
          "customers:manage",
          {
            action,
            fingerprint,
            idempotencyKey: command.idempotencyKey,
            schema: customerSchema,
          },
        );
        if (replay) return { customer: replay, replayed: true };

        const [record] = await tx
          .insert(customer)
          .values({
            businessId: access.businessId,
            name: command.name,
            phone: command.phone ?? null,
            email: command.email ?? null,
            notes: command.notes ?? null,
          })
          .returning();
        if (!record) throw new Error("Customer insert returned no record");
        const result = toCustomer(record);
        await insertOperation(tx, identity, {
          customerId: result.id,
          resultSnapshot: result,
        });
        return { customer: result, replayed: false };
      });
    },

    async updateCustomer(actor, customerId, rawCommand) {
      if (!uuidPattern.test(customerId)) {
        throw new ProductError("NOT_FOUND", "Customer was not found");
      }
      const command = validate(
        updateCustomerRequestSchema,
        rawCommand,
        "Customer changes are invalid",
      );
      const action = "customer.updated";
      const fingerprint = await commandFingerprint(action, {
        customerId,
        email: command.email,
        name: command.name,
        notes: command.notes,
        phone: command.phone,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginReceivableOperation(
          tx,
          actor,
          "customers:manage",
          {
            action,
            fingerprint,
            idempotencyKey: command.idempotencyKey,
            schema: customerSchema,
          },
        );
        if (replay) return { customer: replay, replayed: true };

        const [existing] = await tx
          .select()
          .from(customer)
          .where(and(eq(customer.businessId, access.businessId), eq(customer.id, customerId)))
          .limit(1)
          .for("update");
        if (!existing) throw new ProductError("NOT_FOUND", "Customer was not found");
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "An archived customer cannot be changed");
        }
        const [record] = await tx
          .update(customer)
          .set({
            ...(command.name !== undefined ? { name: command.name } : {}),
            ...(command.phone !== undefined ? { phone: command.phone } : {}),
            ...(command.email !== undefined ? { email: command.email } : {}),
            ...(command.notes !== undefined ? { notes: command.notes } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(customer.businessId, access.businessId), eq(customer.id, customerId)))
          .returning();
        if (!record) throw new Error("Customer update returned no record");
        const result = toCustomer(record);
        await insertOperation(tx, identity, {
          customerId,
          resultSnapshot: result,
        });
        return { customer: result, replayed: false };
      });
    },

    async archiveCustomer(actor, customerId, rawCommand) {
      if (!uuidPattern.test(customerId)) {
        throw new ProductError("NOT_FOUND", "Customer was not found");
      }
      const command = validate(
        archiveCustomerRequestSchema,
        rawCommand,
        "Customer archive confirmation is invalid",
      );
      const action = "customer.archived";
      const fingerprint = await commandFingerprint(action, { customerId });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginReceivableOperation(
          tx,
          actor,
          "customers:manage",
          {
            action,
            fingerprint,
            idempotencyKey: command.idempotencyKey,
            schema: customerSchema,
          },
        );
        if (replay) return { customer: replay, replayed: true };

        const [existing] = await tx
          .select()
          .from(customer)
          .where(and(eq(customer.businessId, access.businessId), eq(customer.id, customerId)))
          .limit(1)
          .for("update");
        if (!existing) throw new ProductError("NOT_FOUND", "Customer was not found");
        if (existing.status === "archived") {
          throw new ProductError("CONFLICT", "The customer is already archived");
        }
        // Archived customers reject payments, so archiving with debt strands it.
        const [debt] = await tx.execute<{ owes: boolean }>(sql`
          select exists (
            select 1
            from ${receivable}
            left join (
              select
                ${receivablePayment.receivableId} as receivable_id,
                coalesce(sum(case
                  when ${receivablePayment.kind} = 'payment' then ${receivablePayment.amountMinorUnits}
                  else -${receivablePayment.amountMinorUnits}
                end), 0::numeric) as paid
              from ${receivablePayment}
              where ${receivablePayment.businessId} = ${access.businessId}
              group by ${receivablePayment.receivableId}
            ) payment_totals on payment_totals.receivable_id = ${receivable.id}
            where ${receivable.businessId} = ${access.businessId}
              and ${receivable.customerId} = ${customerId}
              and ${receivable.status} = 'posted'
              and ${receivable.originalMinorUnits} - coalesce(payment_totals.paid, 0::numeric) > 0
          ) as owes
        `);
        if (!debt) throw new Error("Customer outstanding-balance query returned no row");
        if (debt.owes) {
          throw new ProductError(
            "CONFLICT",
            "The customer still has an outstanding balance and cannot be archived",
          );
        }
        const [record] = await tx
          .update(customer)
          .set({ status: "archived", updatedAt: new Date() })
          .where(and(eq(customer.businessId, access.businessId), eq(customer.id, customerId)))
          .returning();
        if (!record) throw new Error("Customer archive returned no record");
        const result = toCustomer(record);
        await insertOperation(tx, identity, {
          customerId,
          resultSnapshot: result,
        });
        return { customer: result, replayed: false };
      });
    },
  };
}
