import {
  type ExpenseCommandResult,
  expenseCommandResultSchema,
  postExpenseRequestSchema,
  voidExpenseRequestSchema,
} from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { parseMinorUnits } from "../money.ts";
import { beginOperation, fingerprintCommand, saveOperation } from "../operation-log.ts";
import { cashMovement, expense } from "../schema/cash.ts";
import { toCashMovement, toExpense } from "./mappers.ts";
import {
  cashOperationLog,
  getAccountBalance,
  lockAccount,
  requireCurrency,
  requireSufficientBalance,
} from "./records.ts";
import type { CashRepository } from "./types.ts";

type ExpenseCommands = Pick<CashRepository, "postExpense" | "voidExpense">;

export function createExpenseCommands(db: Database): ExpenseCommands {
  return {
    async postExpense(actor, rawCommand) {
      const command = parseInput(
        postExpenseRequestSchema,
        rawCommand,
        "Expense confirmation is invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "expense.post";
      const commandFingerprint = await fingerprintCommand(action, payload);
      const amount = parseMinorUnits(command.amountMinorUnits, "Amount", { allowZero: false });

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: cashOperationLog,
          permissions: ["expenses:manage", "cash:manage"],
          snapshot: expenseCommandResultSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const businessId = access.businessId;
        requireCurrency(access, command.currency);
        const account = await lockAccount(tx, businessId, command.accountId, true);
        requireCurrency(access, account.currency);
        const balance = await getAccountBalance(tx, businessId, account.id);
        requireSufficientBalance(account, balance, amount);
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [createdExpense] = await tx
          .insert(expense)
          .values({
            businessId,
            accountId: account.id,
            category: command.category,
            amountMinorUnits: amount,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            description: command.description,
            payee: command.payee ?? null,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!createdExpense) throw new Error("Expense insert returned no record");
        const [movement] = await tx
          .insert(cashMovement)
          .values({
            businessId,
            accountId: account.id,
            direction: "out",
            action: "expense",
            amountMinorUnits: amount,
            deltaMinorUnits: -amount,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            reason: command.description,
            expenseId: createdExpense.id,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!movement) throw new Error("Expense cash movement insert returned no record");
        const result: ExpenseCommandResult = {
          expense: toExpense(createdExpense),
          movement: toCashMovement(movement),
          replayed: false,
        };
        await saveOperation(tx, cashOperationLog, identity, {
          resourceId: createdExpense.id,
          result,
        });
        return result;
      });
    },

    async voidExpense(actor, expenseId, rawCommand) {
      const command = parseInput(
        voidExpenseRequestSchema,
        rawCommand,
        "Expense void confirmation is invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "expense.void";
      const commandFingerprint = await fingerprintCommand(action, { expenseId, ...payload });

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: cashOperationLog,
          permissions: ["expenses:manage", "cash:manage"],
          snapshot: expenseCommandResultSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const businessId = access.businessId;
        const [current] = await tx
          .select()
          .from(expense)
          .where(and(eq(expense.businessId, businessId), eq(expense.id, expenseId)))
          .limit(1)
          .for("update");
        if (!current) throw new ProductError("NOT_FOUND", "Expense was not found");
        if (current.status !== "posted") {
          throw new ProductError("CONFLICT", "Expense is already voided");
        }
        const [originalMovement] = await tx
          .select()
          .from(cashMovement)
          .where(
            and(
              eq(cashMovement.businessId, businessId),
              eq(cashMovement.expenseId, expenseId),
              eq(cashMovement.action, "expense"),
            ),
          )
          .limit(1)
          .for("update");
        if (!originalMovement) throw new Error("Posted expense has no cash movement");
        await lockAccount(tx, businessId, current.accountId, false);
        const occurredAt = resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [reversal] = await tx
          .insert(cashMovement)
          .values({
            businessId,
            accountId: current.accountId,
            direction: "in",
            action: "reverse",
            amountMinorUnits: current.amountMinorUnits,
            deltaMinorUnits: current.amountMinorUnits,
            currency: current.currency,
            currencyMinorUnitDigits: current.currencyMinorUnitDigits,
            occurredAt,
            occurredLocalDate: command.occurredLocalDate,
            occurredLocalTime: command.occurredLocalTime,
            timeZone: access.timeZone,
            reason: command.reason,
            reversalOfMovementId: originalMovement.id,
            createdByUserId: actor.userId,
          })
          .returning();
        if (!reversal) throw new Error("Expense reversal movement insert returned no record");
        const [voided] = await tx
          .update(expense)
          .set({
            status: "voided",
            voidedAt: sql`transaction_timestamp()`,
            voidedByUserId: actor.userId,
            voidReason: command.reason,
          })
          .where(and(eq(expense.businessId, businessId), eq(expense.id, expenseId)))
          .returning();
        if (!voided) throw new Error("Expense void returned no record");
        const result: ExpenseCommandResult = {
          expense: toExpense(voided),
          movement: toCashMovement(reversal),
          replayed: false,
        };
        await saveOperation(tx, cashOperationLog, identity, { resourceId: expenseId, result });
        return result;
      });
    },
  };
}
