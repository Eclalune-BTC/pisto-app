import {
  archiveCustomerRequestSchema,
  createCustomerRequestSchema,
  customerSchema,
  updateCustomerRequestSchema,
} from "@pisto/contracts";
import { and, eq } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError } from "../product.ts";
import { customer } from "../schema/receivables.ts";
import { authorize, insertOperation, lockIdempotencyKey, readOperationSnapshot } from "./access.ts";
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
        const access = await authorize(tx, actor, "customers:manage");
        await lockIdempotencyKey(tx, actor, access.businessId, command.idempotencyKey);
        const replay = await readOperationSnapshot({
          action,
          actor,
          businessId: access.businessId,
          fingerprint,
          idempotencyKey: command.idempotencyKey,
          schema: customerSchema,
          tx,
        });
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
        await insertOperation(tx, {
          action,
          actor,
          businessId: access.businessId,
          customerId: result.id,
          fingerprint,
          idempotencyKey: command.idempotencyKey,
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
        const access = await authorize(tx, actor, "customers:manage");
        await lockIdempotencyKey(tx, actor, access.businessId, command.idempotencyKey);
        const replay = await readOperationSnapshot({
          action,
          actor,
          businessId: access.businessId,
          fingerprint,
          idempotencyKey: command.idempotencyKey,
          schema: customerSchema,
          tx,
        });
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
        await insertOperation(tx, {
          action,
          actor,
          businessId: access.businessId,
          customerId,
          fingerprint,
          idempotencyKey: command.idempotencyKey,
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
        const access = await authorize(tx, actor, "customers:manage");
        await lockIdempotencyKey(tx, actor, access.businessId, command.idempotencyKey);
        const replay = await readOperationSnapshot({
          action,
          actor,
          businessId: access.businessId,
          fingerprint,
          idempotencyKey: command.idempotencyKey,
          schema: customerSchema,
          tx,
        });
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
        const [record] = await tx
          .update(customer)
          .set({ status: "archived", updatedAt: new Date() })
          .where(and(eq(customer.businessId, access.businessId), eq(customer.id, customerId)))
          .returning();
        if (!record) throw new Error("Customer archive returned no record");
        const result = toCustomer(record);
        await insertOperation(tx, {
          action,
          actor,
          businessId: access.businessId,
          customerId,
          fingerprint,
          idempotencyKey: command.idempotencyKey,
          resultSnapshot: result,
        });
        return { customer: result, replayed: false };
      });
    },
  };
}
