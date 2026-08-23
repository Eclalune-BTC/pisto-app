import {
  type ExpenseCommandResult,
  type PostExpenseRequest,
  postExpenseRequestSchema,
  type VoidExpenseRequest,
  voidExpenseRequestSchema,
} from "@pisto/contracts";
import { and, eq } from "drizzle-orm";

import type { Database } from "../client.ts";
import { type ProductActor, ProductError, resolveLocalDateTime } from "../product.ts";
import { cashMovement, expense } from "../schema/cash.ts";
import {
  beginCashOperation,
  getAccountBalance,
  lockAccount,
  requireActiveBusiness,
  requireCurrency,
  requireSufficientBalance,
  saveReceipt,
} from "./access.ts";
import {
  fingerprintCashCommand,
  isCashResourceId,
  parseCashMinorUnits,
  replayExpenseResult,
} from "./codec.ts";
import { toCashMovement, toExpense } from "./mappers.ts";

export async function postPaidExpense(
  db: Database,
  actor: ProductActor,
  rawCommand: PostExpenseRequest,
): Promise<ExpenseCommandResult> {
  const parsed = postExpenseRequestSchema.safeParse(rawCommand);
  if (!parsed.success)
    throw new ProductError("VALIDATION_ERROR", "Expense confirmation is invalid");
  const command = parsed.data;
  const businessId = requireActiveBusiness(actor);
  const { idempotencyKey, ...payload } = command;
  const commandFingerprint = await fingerprintCashCommand("expense.post", payload);
  const amount = parseCashMinorUnits(command.amountMinorUnits);

  return db.transaction(async (tx) => {
    const { access, identity, replay } = await beginCashOperation(
      tx,
      actor,
      ["expenses:manage", "cash:manage"],
      {
        action: "expense.post",
        commandFingerprint,
        idempotencyKey,
      },
    );
    if (replay) return replayExpenseResult(replay.result);
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
    await saveReceipt(tx, identity, {
      resourceId: createdExpense.id,
      result,
    });
    return result;
  });
}

export async function voidPaidExpense(
  db: Database,
  actor: ProductActor,
  expenseId: string,
  rawCommand: VoidExpenseRequest,
): Promise<ExpenseCommandResult> {
  if (!isCashResourceId(expenseId)) throw new ProductError("NOT_FOUND", "Expense was not found");
  const parsed = voidExpenseRequestSchema.safeParse(rawCommand);
  if (!parsed.success) {
    throw new ProductError("VALIDATION_ERROR", "Expense void confirmation is invalid");
  }
  const command = parsed.data;
  const businessId = requireActiveBusiness(actor);
  const { idempotencyKey, ...payload } = command;
  const commandFingerprint = await fingerprintCashCommand("expense.void", {
    expenseId,
    ...payload,
  });

  return db.transaction(async (tx) => {
    const { access, identity, replay } = await beginCashOperation(
      tx,
      actor,
      ["expenses:manage", "cash:manage"],
      {
        action: "expense.void",
        commandFingerprint,
        idempotencyKey,
      },
    );
    if (replay) return replayExpenseResult(replay.result);
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
        voidedAt: access.queriedAt,
        voidedByUserId: actor.userId,
        voidReason: command.reason,
        updatedAt: new Date(),
      })
      .where(and(eq(expense.businessId, businessId), eq(expense.id, expenseId)))
      .returning();
    if (!voided) throw new Error("Expense void returned no record");
    const result: ExpenseCommandResult = {
      expense: toExpense(voided),
      movement: toCashMovement(reversal),
      replayed: false,
    };
    await saveReceipt(tx, identity, {
      resourceId: expenseId,
      result,
    });
    return result;
  });
}
