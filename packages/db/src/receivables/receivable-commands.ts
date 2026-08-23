import {
  applyReceivablePaymentRequestSchema,
  postReceivableRequestSchema,
  receivableSchema,
  reverseReceivablePaymentRequestSchema,
  voidReceivableRequestSchema,
} from "@pisto/contracts";
import { and, eq } from "drizzle-orm";
import {
  appendReceivablePaymentCashMovement,
  reverseReceivablePaymentCashMovement,
} from "../cash/receivable-ledger.ts";
import type { Database } from "../client.ts";
import { ProductError, resolveLocalDateTime } from "../product.ts";
import { customer, receivable, receivablePayment } from "../schema/receivables.ts";
import {
  beginReceivableOperation,
  currentReceivable,
  getPaidMinorUnits,
  insertOperation,
  loadReceivable,
} from "./access.ts";
import {
  assertCalendarDate,
  commandFingerprint,
  parsePositiveMinorUnits,
  paymentResultSchema,
  uuidPattern,
  validate,
} from "./codec.ts";
import { toPayment } from "./mappers.ts";
import type { ReceivablesRepository } from "./types.ts";

type ReceivableCommands = Pick<
  ReceivablesRepository,
  "applyPayment" | "postReceivable" | "reversePayment" | "voidReceivable"
>;

export function createReceivableCommands(db: Database): ReceivableCommands {
  return {
    async postReceivable(actor, rawCommand) {
      const command = validate(
        postReceivableRequestSchema,
        rawCommand,
        "Receivable details are invalid",
      );
      assertCalendarDate(command.postedDate, "The posted date");
      if (command.dueDate) assertCalendarDate(command.dueDate, "The due date");
      const action = "receivable.posted";
      const fingerprint = await commandFingerprint(action, {
        customerId: command.customerId,
        description: command.description,
        dueDate: command.dueDate ?? null,
        originalMinorUnits: command.originalMinorUnits,
        postedDate: command.postedDate,
      });
      const originalMinorUnits = parsePositiveMinorUnits(command.originalMinorUnits);
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginReceivableOperation(
          tx,
          actor,
          "receivables:manage",
          {
            action,
            fingerprint,
            idempotencyKey: command.idempotencyKey,
            schema: receivableSchema,
          },
        );
        if (replay) return { receivable: replay, replayed: true };

        const [customerRecord] = await tx
          .select({ status: customer.status })
          .from(customer)
          .where(
            and(eq(customer.businessId, access.businessId), eq(customer.id, command.customerId)),
          )
          .limit(1)
          .for("update");
        if (!customerRecord) throw new ProductError("NOT_FOUND", "Customer was not found");
        if (customerRecord.status === "archived") {
          throw new ProductError("CONFLICT", "An archived customer cannot receive a new charge");
        }

        const [record] = await tx
          .insert(receivable)
          .values({
            businessId: access.businessId,
            customerId: command.customerId,
            originalMinorUnits,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            description: command.description,
            postedDate: command.postedDate,
            dueDate: command.dueDate ?? null,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!record) throw new Error("Receivable insert returned no record");
        const result = await currentReceivable(tx, access, record);
        await insertOperation(tx, identity, {
          customerId: command.customerId,
          receivableId: result.id,
          resultSnapshot: result,
        });
        return { receivable: result, replayed: false };
      });
    },

    async voidReceivable(actor, receivableId, rawCommand) {
      if (!uuidPattern.test(receivableId)) {
        throw new ProductError("NOT_FOUND", "Receivable was not found");
      }
      const command = validate(
        voidReceivableRequestSchema,
        rawCommand,
        "Receivable void confirmation is invalid",
      );
      const action = "receivable.voided";
      const fingerprint = await commandFingerprint(action, {
        reason: command.reason,
        receivableId,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginReceivableOperation(
          tx,
          actor,
          "receivables:manage",
          {
            action,
            fingerprint,
            idempotencyKey: command.idempotencyKey,
            schema: receivableSchema,
          },
        );
        if (replay) return { receivable: replay, replayed: true };

        const existing = await loadReceivable(tx, access, receivableId, true);
        if (existing.status === "voided") {
          throw new ProductError("CONFLICT", "The receivable is already voided");
        }
        const paidMinorUnits = await getPaidMinorUnits(tx, access.businessId, receivableId);
        if (paidMinorUnits !== 0n) {
          throw new ProductError(
            "CONFLICT",
            "Reverse every applied payment before voiding this receivable",
          );
        }
        const [record] = await tx
          .update(receivable)
          .set({
            status: "voided",
            voidedAt: new Date(),
            voidedByUserId: actor.userId,
            voidReason: command.reason,
            updatedAt: new Date(),
          })
          .where(and(eq(receivable.businessId, access.businessId), eq(receivable.id, receivableId)))
          .returning();
        if (!record) throw new Error("Receivable void returned no record");
        const result = await currentReceivable(tx, access, record);
        await insertOperation(tx, identity, {
          customerId: record.customerId,
          receivableId,
          resultSnapshot: result,
        });
        return { receivable: result, replayed: false };
      });
    },

    async applyPayment(actor, receivableId, rawCommand) {
      if (!uuidPattern.test(receivableId)) {
        throw new ProductError("NOT_FOUND", "Receivable was not found");
      }
      const command = validate(
        applyReceivablePaymentRequestSchema,
        rawCommand,
        "Receivable payment confirmation is invalid",
      );
      const action = "receivable.payment_applied";
      const fingerprint = await commandFingerprint(action, {
        amountMinorUnits: command.amountMinorUnits,
        cashAccountId: command.cashAccountId,
        occurredLocalDate: command.occurredLocalDate,
        occurredLocalTime: command.occurredLocalTime,
        receivableId,
        reference: command.reference ?? null,
      });
      const amountMinorUnits = parsePositiveMinorUnits(command.amountMinorUnits);
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginReceivableOperation(
          tx,
          actor,
          ["receivables:manage", "cash:manage"],
          {
            action,
            fingerprint,
            idempotencyKey: command.idempotencyKey,
            schema: paymentResultSchema,
          },
        );
        if (replay) return { ...replay, replayed: true };

        const receivableRecord = await loadReceivable(tx, access, receivableId, true);
        if (receivableRecord.status === "voided") {
          throw new ProductError("CONFLICT", "A voided receivable cannot receive a payment");
        }
        const [customerRecord] = await tx
          .select({ status: customer.status })
          .from(customer)
          .where(
            and(
              eq(customer.businessId, access.businessId),
              eq(customer.id, receivableRecord.customerId),
            ),
          )
          .limit(1)
          .for("share");
        if (!customerRecord) throw new Error("Receivable customer is missing");
        if (customerRecord.status === "archived") {
          throw new ProductError("CONFLICT", "An archived customer cannot receive a new payment");
        }
        const paidMinorUnits = await getPaidMinorUnits(tx, access.businessId, receivableId);
        if (amountMinorUnits > receivableRecord.originalMinorUnits - paidMinorUnits) {
          throw new ProductError("CONFLICT", "The payment exceeds the outstanding balance");
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [record] = await tx
          .insert(receivablePayment)
          .values({
            businessId: access.businessId,
            receivableId,
            customerId: receivableRecord.customerId,
            kind: "payment",
            amountMinorUnits,
            currency: receivableRecord.currency,
            currencyMinorUnitDigits: receivableRecord.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            cashAccountId: command.cashAccountId,
            reference: command.reference ?? null,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!record) throw new Error("Receivable payment insert returned no record");
        await appendReceivablePaymentCashMovement(tx, {
          access,
          accountId: command.cashAccountId,
          actorUserId: actor.userId,
          amountMinorUnits,
          currency: record.currency,
          currencyMinorUnitDigits: record.currencyMinorUnitDigits,
          occurredAt,
          occurredLocalDate: command.occurredLocalDate,
          occurredLocalTime: command.occurredLocalTime,
          receivablePaymentId: record.id,
        });
        const result = {
          payment: toPayment(record),
          receivable: await currentReceivable(tx, access, receivableRecord),
        };
        await insertOperation(tx, identity, {
          customerId: receivableRecord.customerId,
          paymentId: record.id,
          receivableId,
          resultSnapshot: result,
        });
        return { ...result, replayed: false };
      });
    },

    async reversePayment(actor, paymentId, rawCommand) {
      if (!uuidPattern.test(paymentId)) {
        throw new ProductError("NOT_FOUND", "Receivable payment was not found");
      }
      const command = validate(
        reverseReceivablePaymentRequestSchema,
        rawCommand,
        "Payment reversal confirmation is invalid",
      );
      const action = "receivable.payment_reversed";
      const fingerprint = await commandFingerprint(action, {
        occurredLocalDate: command.occurredLocalDate,
        occurredLocalTime: command.occurredLocalTime,
        paymentId,
        reference: command.reference ?? null,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginReceivableOperation(
          tx,
          actor,
          ["receivables:manage", "cash:manage"],
          {
            action,
            fingerprint,
            idempotencyKey: command.idempotencyKey,
            schema: paymentResultSchema,
          },
        );
        if (replay) return { ...replay, replayed: true };

        const [original] = await tx
          .select()
          .from(receivablePayment)
          .where(
            and(
              eq(receivablePayment.businessId, access.businessId),
              eq(receivablePayment.id, paymentId),
              eq(receivablePayment.kind, "payment"),
            ),
          )
          .limit(1)
          .for("update");
        if (!original) throw new ProductError("NOT_FOUND", "Receivable payment was not found");
        const receivableRecord = await loadReceivable(tx, access, original.receivableId, true);
        const [existingReversal] = await tx
          .select({ id: receivablePayment.id })
          .from(receivablePayment)
          .where(
            and(
              eq(receivablePayment.businessId, access.businessId),
              eq(receivablePayment.reversesPaymentId, paymentId),
            ),
          )
          .limit(1);
        if (existingReversal) {
          throw new ProductError("CONFLICT", "The payment is already reversed");
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [record] = await tx
          .insert(receivablePayment)
          .values({
            businessId: access.businessId,
            receivableId: original.receivableId,
            customerId: original.customerId,
            kind: "reversal",
            amountMinorUnits: original.amountMinorUnits,
            currency: original.currency,
            currencyMinorUnitDigits: original.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            cashAccountId: original.cashAccountId,
            reference: command.reference ?? null,
            reversesPaymentId: original.id,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!record) throw new Error("Receivable payment reversal insert returned no record");
        await reverseReceivablePaymentCashMovement(tx, {
          access,
          actorUserId: actor.userId,
          occurredAt,
          occurredLocalDate: command.occurredLocalDate,
          occurredLocalTime: command.occurredLocalTime,
          originalReceivablePaymentId: original.id,
        });
        const result = {
          payment: toPayment(record),
          receivable: await currentReceivable(tx, access, receivableRecord),
        };
        await insertOperation(tx, identity, {
          customerId: original.customerId,
          paymentId: record.id,
          receivableId: original.receivableId,
          resultSnapshot: result,
        });
        return { ...result, replayed: false };
      });
    },
  };
}
