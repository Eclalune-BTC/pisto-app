import {
  type CashMovementCommandResult,
  type CashTransferCommandResult,
  cashMovementCommandResultSchema,
  cashTransferCommandResultSchema,
  recordCashAdjustmentRequestSchema,
  reverseCashMovementRequestSchema,
  transferCashRequestSchema,
} from "@pisto/contracts";
import { and, eq } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { parseMinorUnits } from "../money.ts";
import { beginOperation, fingerprintCommand, saveOperation } from "../operation-log.ts";
import { cashMovement, cashTransfer } from "../schema/cash.ts";
import { toCashMovement, toCashTransfer } from "./mappers.ts";
import {
  cashOperationLog,
  getAccountBalance,
  lockAccount,
  lockAccounts,
  requireCurrency,
  requireSufficientBalance,
} from "./records.ts";
import type { CashRepository } from "./types.ts";

type MovementCommands = Pick<CashRepository, "recordAdjustment" | "reverseAdjustment" | "transfer">;

export function createMovementCommands(db: Database): MovementCommands {
  return {
    async recordAdjustment(actor, rawCommand) {
      const command = parseInput(
        recordCashAdjustmentRequestSchema,
        rawCommand,
        "Cash adjustment is invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "cash.adjust";
      const commandFingerprint = await fingerprintCommand(action, payload);
      const amount = parseMinorUnits(command.amountMinorUnits, "Amount", { allowZero: false });

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: cashOperationLog,
          permissions: ["cash:manage"],
          snapshot: cashMovementCommandResultSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const businessId = access.businessId;
        requireCurrency(access, command.currency);
        const account = await lockAccount(tx, businessId, command.accountId, true);
        if (command.direction === "out") {
          requireSufficientBalance(
            account,
            await getAccountBalance(tx, businessId, account.id),
            amount,
          );
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [movement] = await tx
          .insert(cashMovement)
          .values({
            businessId,
            accountId: account.id,
            direction: command.direction,
            action: command.direction === "in" ? "adjustment_in" : "adjustment_out",
            amountMinorUnits: amount,
            deltaMinorUnits: command.direction === "in" ? amount : -amount,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            reason: command.reason,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!movement) throw new Error("Cash adjustment insert returned no record");
        const result: CashMovementCommandResult = {
          movement: toCashMovement(movement),
          replayed: false,
        };
        await saveOperation(tx, cashOperationLog, identity, { resourceId: movement.id, result });
        return result;
      });
    },

    async reverseAdjustment(actor, movementId, rawCommand) {
      const command = parseInput(
        reverseCashMovementRequestSchema,
        rawCommand,
        "Cash reversal is invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "cash.reverse";
      const commandFingerprint = await fingerprintCommand(action, { movementId, ...payload });

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: cashOperationLog,
          permissions: ["cash:manage"],
          snapshot: cashMovementCommandResultSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const businessId = access.businessId;
        const [original] = await tx
          .select()
          .from(cashMovement)
          .where(and(eq(cashMovement.businessId, businessId), eq(cashMovement.id, movementId)))
          .limit(1)
          .for("update");
        if (!original) throw new ProductError("NOT_FOUND", "Cash movement was not found");
        if (original.action !== "adjustment_in" && original.action !== "adjustment_out") {
          throw new ProductError("CONFLICT", "Only a manual adjustment can be reversed here");
        }
        const [priorReversal] = await tx
          .select({ id: cashMovement.id })
          .from(cashMovement)
          .where(
            and(
              eq(cashMovement.businessId, businessId),
              eq(cashMovement.reversalOfMovementId, movementId),
            ),
          )
          .limit(1);
        if (priorReversal) {
          throw new ProductError("CONFLICT", "Cash adjustment is already reversed");
        }
        const account = await lockAccount(tx, businessId, original.accountId, false);
        const reversalDirection = original.direction === "in" ? "out" : "in";
        if (reversalDirection === "out") {
          requireSufficientBalance(
            account,
            await getAccountBalance(tx, businessId, account.id),
            original.amountMinorUnits,
          );
        }
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [reversal] = await tx
          .insert(cashMovement)
          .values({
            businessId,
            accountId: original.accountId,
            direction: reversalDirection,
            action: "reverse",
            amountMinorUnits: original.amountMinorUnits,
            deltaMinorUnits:
              reversalDirection === "in" ? original.amountMinorUnits : -original.amountMinorUnits,
            currency: original.currency,
            currencyMinorUnitDigits: original.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            reason: command.reason,
            reversalOfMovementId: original.id,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!reversal) throw new Error("Cash reversal insert returned no record");
        const result: CashMovementCommandResult = {
          movement: toCashMovement(reversal),
          replayed: false,
        };
        await saveOperation(tx, cashOperationLog, identity, { resourceId: reversal.id, result });
        return result;
      });
    },

    async transfer(actor, rawCommand) {
      const command = parseInput(transferCashRequestSchema, rawCommand, "Cash transfer is invalid");
      const { idempotencyKey, ...payload } = command;
      const action = "cash.transfer";
      const commandFingerprint = await fingerprintCommand(action, payload);
      const amount = parseMinorUnits(command.amountMinorUnits, "Amount", { allowZero: false });

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: cashOperationLog,
          permissions: ["cash:manage"],
          snapshot: cashTransferCommandResultSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const businessId = access.businessId;
        requireCurrency(access, command.currency);
        const accounts = await lockAccounts(tx, businessId, [
          command.fromAccountId,
          command.toAccountId,
        ]);
        const from = accounts.find(({ id }) => id === command.fromAccountId);
        const to = accounts.find(({ id }) => id === command.toAccountId);
        if (!from || !to) throw new ProductError("NOT_FOUND", "Cash account was not found");
        if (from.status !== "active" || to.status !== "active") {
          throw new ProductError("CONFLICT", "Transfers require two active cash accounts");
        }
        requireCurrency(access, from.currency);
        requireCurrency(access, to.currency);
        requireSufficientBalance(from, await getAccountBalance(tx, businessId, from.id), amount);
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [createdTransfer] = await tx
          .insert(cashTransfer)
          .values({
            businessId,
            fromAccountId: from.id,
            toAccountId: to.id,
            amountMinorUnits: amount,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            note: command.note ?? null,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!createdTransfer) throw new Error("Cash transfer insert returned no record");
        const leg = {
          businessId,
          amountMinorUnits: amount,
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          occurredAt,
          occurredLocalDate: command.occurredLocalDate,
          occurredLocalTime: command.occurredLocalTime,
          timeZone: access.timeZone,
          reason: command.note ?? "Cash transfer",
          transferId: createdTransfer.id,
          createdByUserId: actor.userId,
        };
        const movements = await tx
          .insert(cashMovement)
          .values([
            {
              ...leg,
              accountId: from.id,
              direction: "out",
              action: "transfer_out",
              deltaMinorUnits: -amount,
            },
            {
              ...leg,
              accountId: to.id,
              direction: "in",
              action: "transfer_in",
              deltaMinorUnits: amount,
            },
          ])
          .returning();
        const outRecord = movements.find(({ action }) => action === "transfer_out");
        const inRecord = movements.find(({ action }) => action === "transfer_in");
        if (!outRecord || !inRecord) throw new Error("Cash transfer movement pair is incomplete");
        const result: CashTransferCommandResult = {
          transfer: toCashTransfer(createdTransfer, outRecord.id, inRecord.id),
          movements: [toCashMovement(outRecord), toCashMovement(inRecord)],
          replayed: false,
        };
        await saveOperation(tx, cashOperationLog, identity, {
          resourceId: createdTransfer.id,
          result,
        });
        return result;
      });
    },
  };
}
