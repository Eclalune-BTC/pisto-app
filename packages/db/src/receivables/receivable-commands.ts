import {
  applyReceivablePaymentRequestSchema,
  postReceivableRequestSchema,
  receivableSchema,
  reverseReceivablePaymentRequestSchema,
  voidReceivableRequestSchema,
} from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import {
  appendReceivablePaymentCashMovement,
  reverseReceivablePaymentCashMovement,
} from "../cash/receivable-ledger.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { parseMinorUnits } from "../money.ts";
import { beginOperation, saveOperation } from "../operation-log.ts";
import { customer, receivable, receivablePayment } from "../schema/receivables.ts";
import { paymentResultSchema, receivableCommandFingerprint } from "./codec.ts";
import { toPayment } from "./mappers.ts";
import {
  currentReceivable,
  getPaidMinorUnits,
  loadReceivable,
  receivableOperationLog,
} from "./records.ts";
import type { ReceivablesRepository } from "./types.ts";

type ReceivableCommands = Pick<
  ReceivablesRepository,
  "applyPayment" | "postReceivable" | "reversePayment" | "voidReceivable"
>;

export function createReceivableCommands(db: Database): ReceivableCommands {
  return {
    async postReceivable(actor, rawCommand) {
      const command = parseInput(
        postReceivableRequestSchema,
        rawCommand,
        "Receivable details are invalid",
      );
      const action = "receivable.posted";
      const commandFingerprint = await receivableCommandFingerprint(action, {
        customerId: command.customerId,
        description: command.description,
        dueDate: command.dueDate ?? null,
        originalMinorUnits: command.originalMinorUnits,
        postedDate: command.postedDate,
      });
      const originalMinorUnits = parseMinorUnits(command.originalMinorUnits, "The amount", {
        allowZero: false,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: receivableOperationLog,
          permissions: ["receivables:manage"],
          snapshot: receivableSchema,
        });
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
        await saveOperation(tx, receivableOperationLog, identity, {
          customerId: command.customerId,
          receivableId: result.id,
          resultSnapshot: result,
        });
        return { receivable: result, replayed: false };
      });
    },

    async voidReceivable(actor, receivableId, rawCommand) {
      const command = parseInput(
        voidReceivableRequestSchema,
        rawCommand,
        "Receivable void confirmation is invalid",
      );
      const action = "receivable.voided";
      const commandFingerprint = await receivableCommandFingerprint(action, {
        reason: command.reason,
        receivableId,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: receivableOperationLog,
          permissions: ["receivables:manage"],
          snapshot: receivableSchema,
        });
        if (replay) return { receivable: replay, replayed: true };

        const existing = await loadReceivable(tx, access, receivableId, true);
        if (existing.status === "voided") {
          throw new ProductError("CONFLICT", "The receivable is already voided");
        }
        if ((await getPaidMinorUnits(tx, access.businessId, receivableId)) !== 0n) {
          throw new ProductError(
            "CONFLICT",
            "Reverse every applied payment before voiding this receivable",
          );
        }
        const [record] = await tx
          .update(receivable)
          .set({
            status: "voided",
            voidedAt: sql`transaction_timestamp()`,
            voidedByUserId: actor.userId,
            voidReason: command.reason,
          })
          .where(and(eq(receivable.businessId, access.businessId), eq(receivable.id, receivableId)))
          .returning();
        if (!record) throw new Error("Receivable void returned no record");
        const result = await currentReceivable(tx, access, record);
        await saveOperation(tx, receivableOperationLog, identity, {
          customerId: record.customerId,
          receivableId,
          resultSnapshot: result,
        });
        return { receivable: result, replayed: false };
      });
    },

    async applyPayment(actor, receivableId, rawCommand) {
      const command = parseInput(
        applyReceivablePaymentRequestSchema,
        rawCommand,
        "Receivable payment confirmation is invalid",
      );
      const action = "receivable.payment_applied";
      const commandFingerprint = await receivableCommandFingerprint(action, {
        amountMinorUnits: command.amountMinorUnits,
        cashAccountId: command.cashAccountId,
        occurredLocalDate: command.occurredLocalDate,
        occurredLocalTime: command.occurredLocalTime,
        receivableId,
        reference: command.reference ?? null,
      });
      const amountMinorUnits = parseMinorUnits(command.amountMinorUnits, "The amount", {
        allowZero: false,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: receivableOperationLog,
          permissions: ["receivables:manage", "cash:manage"],
          snapshot: paymentResultSchema,
        });
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
        await saveOperation(tx, receivableOperationLog, identity, {
          customerId: receivableRecord.customerId,
          paymentId: record.id,
          receivableId,
          resultSnapshot: result,
        });
        return { ...result, replayed: false };
      });
    },

    async reversePayment(actor, paymentId, rawCommand) {
      const command = parseInput(
        reverseReceivablePaymentRequestSchema,
        rawCommand,
        "Payment reversal confirmation is invalid",
      );
      const action = "receivable.payment_reversed";
      const commandFingerprint = await receivableCommandFingerprint(action, {
        occurredLocalDate: command.occurredLocalDate,
        occurredLocalTime: command.occurredLocalTime,
        paymentId,
        reference: command.reference ?? null,
      });
      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: receivableOperationLog,
          permissions: ["receivables:manage", "cash:manage"],
          snapshot: paymentResultSchema,
        });
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
        await saveOperation(tx, receivableOperationLog, identity, {
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
