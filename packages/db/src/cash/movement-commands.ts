import {
  type CashMovementCommandResult,
  type CashTransferCommandResult,
  type RecordCashAdjustmentRequest,
  type ReverseCashMovementRequest,
  recordCashAdjustmentRequestSchema,
  reverseCashMovementRequestSchema,
  type TransferCashRequest,
  transferCashRequestSchema,
} from "@pisto/contracts";
import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "../client.ts";
import { type ProductActor, ProductError, resolveLocalDateTime } from "../product.ts";
import { cashAccount, cashMovement, cashTransfer } from "../schema/cash.ts";
import {
  findReplay,
  getAccountBalance,
  lockAccount,
  lockIdempotencyKey,
  requireAccess,
  requireActiveBusiness,
  requireCurrency,
  requireSufficientBalance,
  saveReceipt,
} from "./access.ts";
import {
  fingerprintCashCommand,
  isCashResourceId,
  parseCashMinorUnits,
  replayMovementResult,
  replayTransferResult,
} from "./codec.ts";
import { toCashMovement, toCashTransfer } from "./mappers.ts";

export async function recordCashAdjustment(
  db: Database,
  actor: ProductActor,
  rawCommand: RecordCashAdjustmentRequest,
): Promise<CashMovementCommandResult> {
  const parsed = recordCashAdjustmentRequestSchema.safeParse(rawCommand);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Cash adjustment is invalid");
  const command = parsed.data;
  const businessId = requireActiveBusiness(actor);
  const { idempotencyKey, ...payload } = command;
  const commandFingerprint = await fingerprintCashCommand("cash.adjust", payload);
  const amount = parseCashMinorUnits(command.amountMinorUnits);

  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["cash:manage"]);
    await lockIdempotencyKey(tx, businessId, actor.userId, idempotencyKey);
    const replay = await findReplay(tx, {
      action: "cash.adjust",
      actorUserId: actor.userId,
      businessId,
      commandFingerprint,
      idempotencyKey,
    });
    if (replay) return replayMovementResult(replay);
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
    await saveReceipt(tx, {
      action: "cash.adjust",
      actorUserId: actor.userId,
      businessId,
      commandFingerprint,
      idempotencyKey,
      resourceId: movement.id,
      result,
    });
    return result;
  });
}

export async function reverseCashAdjustment(
  db: Database,
  actor: ProductActor,
  movementId: string,
  rawCommand: ReverseCashMovementRequest,
): Promise<CashMovementCommandResult> {
  if (!isCashResourceId(movementId)) {
    throw new ProductError("NOT_FOUND", "Cash movement was not found");
  }
  const parsed = reverseCashMovementRequestSchema.safeParse(rawCommand);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Cash reversal is invalid");
  const command = parsed.data;
  const businessId = requireActiveBusiness(actor);
  const { idempotencyKey, ...payload } = command;
  const commandFingerprint = await fingerprintCashCommand("cash.reverse", {
    movementId,
    ...payload,
  });

  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["cash:manage"]);
    await lockIdempotencyKey(tx, businessId, actor.userId, idempotencyKey);
    const replay = await findReplay(tx, {
      action: "cash.reverse",
      actorUserId: actor.userId,
      businessId,
      commandFingerprint,
      idempotencyKey,
    });
    if (replay) return replayMovementResult(replay);
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
    if (priorReversal) throw new ProductError("CONFLICT", "Cash adjustment is already reversed");
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
    await saveReceipt(tx, {
      action: "cash.reverse",
      actorUserId: actor.userId,
      businessId,
      commandFingerprint,
      idempotencyKey,
      resourceId: reversal.id,
      result,
    });
    return result;
  });
}

export async function transferCash(
  db: Database,
  actor: ProductActor,
  rawCommand: TransferCashRequest,
): Promise<CashTransferCommandResult> {
  const parsed = transferCashRequestSchema.safeParse(rawCommand);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Cash transfer is invalid");
  const command = parsed.data;
  const businessId = requireActiveBusiness(actor);
  const { idempotencyKey, ...payload } = command;
  const commandFingerprint = await fingerprintCashCommand("cash.transfer", payload);
  const amount = parseCashMinorUnits(command.amountMinorUnits);

  return db.transaction(async (tx) => {
    const access = await requireAccess(tx, actor, ["cash:manage"]);
    await lockIdempotencyKey(tx, businessId, actor.userId, idempotencyKey);
    const replay = await findReplay(tx, {
      action: "cash.transfer",
      actorUserId: actor.userId,
      businessId,
      commandFingerprint,
      idempotencyKey,
    });
    if (replay) return replayTransferResult(replay);
    requireCurrency(access, command.currency);
    const accounts = await tx
      .select()
      .from(cashAccount)
      .where(
        and(
          eq(cashAccount.businessId, businessId),
          inArray(cashAccount.id, [command.fromAccountId, command.toAccountId].sort()),
        ),
      )
      .orderBy(cashAccount.id)
      .for("update");
    if (accounts.length !== 2) throw new ProductError("NOT_FOUND", "Cash account was not found");
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
    const movements = await tx
      .insert(cashMovement)
      .values([
        {
          businessId,
          accountId: from.id,
          direction: "out",
          action: "transfer_out",
          amountMinorUnits: amount,
          deltaMinorUnits: -amount,
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          occurredAt,
          occurredLocalDate: command.occurredLocalDate,
          occurredLocalTime: command.occurredLocalTime,
          timeZone: access.timeZone,
          reason: command.note ?? "Cash transfer",
          transferId: createdTransfer.id,
          createdByUserId: actor.userId,
        },
        {
          businessId,
          accountId: to.id,
          direction: "in",
          action: "transfer_in",
          amountMinorUnits: amount,
          deltaMinorUnits: amount,
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          occurredAt,
          occurredLocalDate: command.occurredLocalDate,
          occurredLocalTime: command.occurredLocalTime,
          timeZone: access.timeZone,
          reason: command.note ?? "Cash transfer",
          transferId: createdTransfer.id,
          createdByUserId: actor.userId,
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
    await saveReceipt(tx, {
      action: "cash.transfer",
      actorUserId: actor.userId,
      businessId,
      commandFingerprint,
      idempotencyKey,
      resourceId: createdTransfer.id,
      result,
    });
    return result;
  });
}
