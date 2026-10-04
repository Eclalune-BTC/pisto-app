import {
  archiveCashAccountRequestSchema,
  type CashAccountCommandResult,
  cashAccountCommandResultSchema,
  createCashAccountRequestSchema,
  updateCashAccountRequestSchema,
} from "@pisto/contracts";
import { and, eq, ne, sql } from "drizzle-orm";

import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { parseMinorUnits } from "../money.ts";
import {
  beginOperation,
  fingerprintCommand,
  lockSemanticKey,
  saveOperation,
} from "../operation-log.ts";
import { cashAccount, cashMovement } from "../schema/cash.ts";
import { toCashAccount, toCashMovement } from "./mappers.ts";
import { cashOperationLog, getAccountBalance, lockAccount, requireCurrency } from "./records.ts";
import type { CashRepository } from "./types.ts";

type AccountCommands = Pick<CashRepository, "archiveAccount" | "createAccount" | "updateAccount">;

export function createAccountCommands(db: Database): AccountCommands {
  return {
    async createAccount(actor, rawCommand) {
      const command = parseInput(
        createCashAccountRequestSchema,
        rawCommand,
        "Cash account is invalid",
      );
      const { idempotencyKey, ...payload } = command;
      const action = "cash_account.create";
      const commandFingerprint = await fingerprintCommand(action, payload);

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: cashOperationLog,
          permissions: ["cash:manage"],
          snapshot: cashAccountCommandResultSchema,
        });
        if (replay) return { ...replay, replayed: true };
        requireCurrency(access, command.currency);
        if (command.opening?.direction === "out" && !command.allowNegativeBalance) {
          throw new ProductError(
            "CONFLICT",
            "An outgoing opening balance requires the explicit negative-balance setting",
          );
        }
        const businessId = access.businessId;
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
          const amount = parseMinorUnits(command.opening.amountMinorUnits, "Amount", {
            allowZero: false,
          });
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
        await saveOperation(tx, cashOperationLog, identity, { resourceId: created.id, result });
        return result;
      });
    },

    async updateAccount(actor, accountId, rawCommand) {
      const command = parseInput(
        updateCashAccountRequestSchema,
        rawCommand,
        "Cash account update is invalid",
      );
      const { idempotencyKey, ...changes } = command;
      const action = "cash_account.update";
      const commandFingerprint = await fingerprintCommand(action, { accountId, ...changes });

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey,
          log: cashOperationLog,
          permissions: ["cash:manage"],
          snapshot: cashAccountCommandResultSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const businessId = access.businessId;
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
                ne(cashAccount.id, accountId),
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
            updatedAt: access.queriedAt,
          })
          .where(and(eq(cashAccount.businessId, businessId), eq(cashAccount.id, accountId)))
          .returning();
        if (!updated) throw new Error("Cash account update returned no record");
        const result: CashAccountCommandResult = {
          account: toCashAccount(updated, balance.toString()),
          openingMovement: null,
          replayed: false,
        };
        await saveOperation(tx, cashOperationLog, identity, { resourceId: accountId, result });
        return result;
      });
    },

    async archiveAccount(actor, accountId, rawCommand) {
      const command = parseInput(
        archiveCashAccountRequestSchema,
        rawCommand,
        "Cash account archive confirmation is invalid",
      );
      const action = "cash_account.archive";
      const commandFingerprint = await fingerprintCommand(action, { accountId });

      return db.transaction(async (tx) => {
        const { access, identity, replay } = await beginOperation(tx, {
          action,
          actor,
          commandFingerprint,
          idempotencyKey: command.idempotencyKey,
          log: cashOperationLog,
          permissions: ["cash:manage"],
          snapshot: cashAccountCommandResultSchema,
        });
        if (replay) return { ...replay, replayed: true };
        const businessId = access.businessId;
        const current = await lockAccount(tx, businessId, accountId, false);
        if (current.status === "archived") {
          throw new ProductError("CONFLICT", "Cash account is already archived");
        }
        const balance = await getAccountBalance(tx, businessId, accountId);
        const [archived] = await tx
          .update(cashAccount)
          .set({ status: "archived", updatedAt: access.queriedAt })
          .where(and(eq(cashAccount.businessId, businessId), eq(cashAccount.id, accountId)))
          .returning();
        if (!archived) throw new Error("Cash account archive returned no record");
        const result: CashAccountCommandResult = {
          account: toCashAccount(archived, balance.toString()),
          openingMovement: null,
          replayed: false,
        };
        await saveOperation(tx, cashOperationLog, identity, { resourceId: accountId, result });
        return result;
      });
    },
  };
}
