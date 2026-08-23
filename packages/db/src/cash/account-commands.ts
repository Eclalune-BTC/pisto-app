import {
  archiveCashAccountRequestSchema,
  type CashAccountCommandResult,
  type CreateCashAccountRequest,
  type UpdateCashAccountRequest,
} from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { lockSemanticKey } from "../operation-log.ts";
import { type ProductActor, ProductError, resolveLocalDateTime } from "../product.ts";
import { cashAccount, cashMovement } from "../schema/cash.ts";
import {
  beginCashOperation,
  getAccountBalance,
  lockAccount,
  requireActiveBusiness,
  requireCurrency,
  saveReceipt,
} from "./access.ts";
import {
  fingerprintCashCommand,
  isCashResourceId,
  parseCashMinorUnits,
  parseCreateAccount,
  parseUpdateAccount,
  replayAccountResult,
} from "./codec.ts";
import { toCashAccount, toCashMovement } from "./mappers.ts";

export async function createCashAccount(
  db: Database,
  actor: ProductActor,
  rawCommand: CreateCashAccountRequest,
): Promise<CashAccountCommandResult> {
  const command = parseCreateAccount(rawCommand);
  const businessId = requireActiveBusiness(actor);
  const { idempotencyKey, ...payload } = command;
  const commandFingerprint = await fingerprintCashCommand("cash_account.create", payload);

  return db.transaction(async (tx) => {
    const { access, identity, replay } = await beginCashOperation(tx, actor, ["cash:manage"], {
      action: "cash_account.create",
      commandFingerprint,
      idempotencyKey,
    });
    if (replay) return replayAccountResult(replay.result);
    requireCurrency(access, command.currency);
    if (command.opening?.direction === "out" && !command.allowNegativeBalance) {
      throw new ProductError(
        "CONFLICT",
        "An outgoing opening balance requires the explicit negative-balance setting",
      );
    }
    await lockSemanticKey(tx, "cash-account-name", businessId, command.name);
    const [duplicate] = await tx
      .select({ id: cashAccount.id })
      .from(cashAccount)
      .where(
        and(
          eq(cashAccount.businessId, businessId),
          sql`lower(${cashAccount.name}) = lower(${command.name})`,
        ),
      )
      .limit(1);
    if (duplicate) throw new ProductError("CONFLICT", "Cash account name already exists");

    const [created] = await tx
      .insert(cashAccount)
      .values({
        businessId,
        name: command.name,
        kind: command.kind,
        allowNegativeBalance: command.allowNegativeBalance,
        currency: access.currency,
        currencyMinorUnitDigits: access.currencyMinorUnitDigits,
        createdByUserId: actor.userId,
      })
      .returning();
    if (!created) throw new Error("Cash account insert returned no record");

    let openingMovement = null;
    let balance = 0n;
    if (command.opening) {
      const amount = parseCashMinorUnits(command.opening.amountMinorUnits);
      const occurredAt = resolveLocalDateTime({
        date: command.opening.occurredLocalDate,
        time: command.opening.occurredLocalTime,
        timeZone: access.timeZone,
      });
      const delta = command.opening.direction === "in" ? amount : -amount;
      const [movement] = await tx
        .insert(cashMovement)
        .values({
          businessId,
          accountId: created.id,
          direction: command.opening.direction,
          action: "opening",
          amountMinorUnits: amount,
          deltaMinorUnits: delta,
          currency: access.currency,
          currencyMinorUnitDigits: access.currencyMinorUnitDigits,
          occurredAt,
          occurredLocalDate: command.opening.occurredLocalDate,
          occurredLocalTime: command.opening.occurredLocalTime,
          timeZone: access.timeZone,
          reason: command.opening.reason,
          createdByUserId: actor.userId,
        })
        .returning();
      if (!movement) throw new Error("Opening cash movement insert returned no record");
      openingMovement = toCashMovement(movement);
      balance = delta;
    }
    const result: CashAccountCommandResult = {
      account: toCashAccount(created, balance.toString()),
      openingMovement,
      replayed: false,
    };
    await saveReceipt(tx, identity, {
      resourceId: created.id,
      result,
    });
    return result;
  });
}

export async function updateCashAccount(
  db: Database,
  actor: ProductActor,
  accountId: string,
  rawCommand: UpdateCashAccountRequest,
): Promise<CashAccountCommandResult> {
  if (!isCashResourceId(accountId)) {
    throw new ProductError("NOT_FOUND", "Cash account was not found");
  }
  const command = parseUpdateAccount(rawCommand);
  const businessId = requireActiveBusiness(actor);
  const { idempotencyKey, ...changes } = command;
  const commandFingerprint = await fingerprintCashCommand("cash_account.update", {
    accountId,
    ...changes,
  });

  return db.transaction(async (tx) => {
    const { identity, replay } = await beginCashOperation(tx, actor, ["cash:manage"], {
      action: "cash_account.update",
      commandFingerprint,
      idempotencyKey,
    });
    if (replay) return replayAccountResult(replay.result);
    const current = await lockAccount(tx, businessId, accountId, true);
    if (
      command.name !== undefined &&
      command.name.toLocaleLowerCase("en-US") !== current.name.toLocaleLowerCase("en-US")
    ) {
      await lockSemanticKey(tx, "cash-account-name", businessId, command.name);
      const [duplicate] = await tx
        .select({ id: cashAccount.id })
        .from(cashAccount)
        .where(
          and(
            eq(cashAccount.businessId, businessId),
            sql`lower(${cashAccount.name}) = lower(${command.name})`,
            sql`${cashAccount.id} <> ${accountId}`,
          ),
        )
        .limit(1);
      if (duplicate) throw new ProductError("CONFLICT", "Cash account name already exists");
    }
    const balance = await getAccountBalance(tx, businessId, accountId);
    if (command.allowNegativeBalance === false && balance < 0n) {
      throw new ProductError(
        "CONFLICT",
        "Negative balances cannot be disabled while this account is below zero",
      );
    }
    const [updated] = await tx
      .update(cashAccount)
      .set({
        ...(command.name !== undefined ? { name: command.name } : {}),
        ...(command.kind !== undefined ? { kind: command.kind } : {}),
        ...(command.allowNegativeBalance !== undefined
          ? { allowNegativeBalance: command.allowNegativeBalance }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(cashAccount.businessId, businessId), eq(cashAccount.id, accountId)))
      .returning();
    if (!updated) throw new Error("Cash account update returned no record");
    const result: CashAccountCommandResult = {
      account: toCashAccount(updated, balance.toString()),
      openingMovement: null,
      replayed: false,
    };
    await saveReceipt(tx, identity, {
      resourceId: accountId,
      result,
    });
    return result;
  });
}

export async function archiveCashAccount(
  db: Database,
  actor: ProductActor,
  accountId: string,
  rawCommand: { idempotencyKey: string },
): Promise<CashAccountCommandResult> {
  if (!isCashResourceId(accountId)) {
    throw new ProductError("NOT_FOUND", "Cash account was not found");
  }
  const parsed = archiveCashAccountRequestSchema.safeParse(rawCommand);
  if (!parsed.success) {
    throw new ProductError("VALIDATION_ERROR", "Cash account archive confirmation is invalid");
  }
  const command = parsed.data;
  const businessId = requireActiveBusiness(actor);
  const commandFingerprint = await fingerprintCashCommand("cash_account.archive", { accountId });

  return db.transaction(async (tx) => {
    const { identity, replay } = await beginCashOperation(tx, actor, ["cash:manage"], {
      action: "cash_account.archive",
      commandFingerprint,
      idempotencyKey: command.idempotencyKey,
    });
    if (replay) return replayAccountResult(replay.result);
    const current = await lockAccount(tx, businessId, accountId, false);
    if (current.status === "archived") {
      throw new ProductError("CONFLICT", "Cash account is already archived");
    }
    const balance = await getAccountBalance(tx, businessId, accountId);
    const [archived] = await tx
      .update(cashAccount)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(cashAccount.businessId, businessId), eq(cashAccount.id, accountId)))
      .returning();
    if (!archived) throw new Error("Cash account archive returned no record");
    const result: CashAccountCommandResult = {
      account: toCashAccount(archived, balance.toString()),
      openingMovement: null,
      replayed: false,
    };
    await saveReceipt(tx, identity, {
      resourceId: accountId,
      result,
    });
    return result;
  });
}
