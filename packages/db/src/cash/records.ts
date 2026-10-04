import { and, eq, inArray, sql } from "drizzle-orm";

import type {
  AuthorizedBusinessContext,
  BusinessDatabaseExecutor,
  DatabaseTransaction,
} from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { sumLedger } from "../money.ts";
import type { OperationLog } from "../operation-log.ts";
import { cashAccount, cashMovement, cashOperationReceipt } from "../schema/cash.ts";
import { correlatedSubquery } from "../subquery.ts";
import type { CashAccountRecord } from "./types.ts";

export const cashOperationLog = {
  conflictMessage: "That confirmation key was already used for a different cash operation",
  result: cashOperationReceipt.result,
  table: cashOperationReceipt,
} satisfies OperationLog<typeof cashOperationReceipt>;

export function requireCurrency(access: AuthorizedBusinessContext, currency: string): void {
  if (currency !== access.currency) {
    throw new ProductError(
      "CONFLICT",
      "The confirmed currency does not match the business currency",
    );
  }
}

export function getAccountBalance(
  executor: BusinessDatabaseExecutor,
  businessId: string,
  accountId: string,
): Promise<bigint> {
  return sumLedger(
    executor,
    {
      table: cashMovement,
      amount: cashMovement.deltaMinorUnits,
      where: and(eq(cashMovement.businessId, businessId), eq(cashMovement.accountId, accountId)),
    },
    "Cash balance",
  );
}

export function accountBalanceText() {
  return correlatedSubquery<string>(sql`coalesce((
    select sum(${cashMovement.deltaMinorUnits})
    from ${cashMovement}
    where ${cashMovement.businessId} = ${cashAccount.businessId}
      and ${cashMovement.accountId} = ${cashAccount.id}
  ), 0)::text`);
}

/**
 * Locks accounts in identifier order so concurrent multi-account commands cannot
 * deadlock. Account identity is immutable, so FOR NO KEY UPDATE serializes balance
 * changes while staying compatible with the FOR KEY SHARE lock a receivable payment's
 * foreign-key check takes on the same account before its cash post.
 */
export function lockAccounts(
  tx: DatabaseTransaction,
  businessId: string,
  accountIds: readonly string[],
): Promise<CashAccountRecord[]> {
  return tx
    .select()
    .from(cashAccount)
    .where(and(eq(cashAccount.businessId, businessId), inArray(cashAccount.id, [...accountIds])))
    .orderBy(cashAccount.id)
    .for("no key update");
}

export async function lockAccount(
  tx: DatabaseTransaction,
  businessId: string,
  accountId: string,
  requireActive: boolean,
): Promise<CashAccountRecord> {
  const [record] = await lockAccounts(tx, businessId, [accountId]);
  if (!record) throw new ProductError("NOT_FOUND", "Cash account was not found");
  if (requireActive && record.status !== "active") {
    throw new ProductError("CONFLICT", "Cash account is archived");
  }
  return record;
}

export function requireSufficientBalance(
  account: CashAccountRecord,
  balance: bigint,
  outflow: bigint,
): void {
  if (!account.allowNegativeBalance && balance - outflow < 0n) {
    throw new ProductError("CONFLICT", "Cash account has insufficient funds");
  }
}
