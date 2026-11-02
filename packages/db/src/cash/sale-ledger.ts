import type { SaleFormOptionsResponse } from "@pisto/contracts";
import { cashAccountKindSchema } from "@pisto/contracts";
import { and, asc, eq, sql } from "drizzle-orm";

import type {
  AuthorizedBusinessContext,
  BusinessDatabaseExecutor,
  DatabaseTransaction,
} from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { cashAccount, cashMovement } from "../schema/cash.ts";
import { getAccountBalance, lockAccount, requireSufficientBalance } from "./records.ts";
import type { CashAccountRecord, CashMovementRecord } from "./types.ts";

/**
 * Cash's owner port for itemized sales (ADR 0016): the sale command coordinates the transaction,
 * while account validity, balance policy and the cash ledger stay here.
 */

interface SaleCashOccurrence {
  actorUserId: string;
  saleId: string;
  occurredAt: Date;
  occurredLocalDate: string;
  occurredLocalTime: string;
  timeZone: string;
}

type PaymentAccount = SaleFormOptionsResponse["data"]["accounts"][number];

/** Names and kinds only: a seller picks where a payment goes without seeing balances. */
export async function listSalePaymentAccounts(
  executor: BusinessDatabaseExecutor,
  businessId: string,
): Promise<PaymentAccount[]> {
  const records = await executor
    .select({ id: cashAccount.id, name: cashAccount.name, kind: cashAccount.kind })
    .from(cashAccount)
    .where(and(eq(cashAccount.businessId, businessId), eq(cashAccount.status, "active")))
    .orderBy(sql`lower(${cashAccount.name})`, asc(cashAccount.id));
  return records.map((record) => ({ ...record, kind: cashAccountKindSchema.parse(record.kind) }));
}

/**
 * The active account a sale's payment enters, locked before the sale references it so a concurrent
 * archive or balance change waits for the sale.
 */
export async function lockSalePaymentAccount(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  accountId: string,
): Promise<CashAccountRecord> {
  const account = await lockAccount(tx, access.businessId, accountId, true);
  if (
    account.currency !== access.currency ||
    account.currencyMinorUnitDigits !== access.currencyMinorUnitDigits
  ) {
    throw new ProductError("CONFLICT", "The selected cash account uses a different currency");
  }
  return account;
}

export async function appendSalePaymentCashMovement(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  input: SaleCashOccurrence & { account: CashAccountRecord; amountMinorUnits: bigint },
): Promise<CashMovementRecord> {
  const { account } = input;
  const [movement] = await tx
    .insert(cashMovement)
    .values({
      businessId: access.businessId,
      accountId: account.id,
      direction: "in",
      action: "sale_payment",
      amountMinorUnits: input.amountMinorUnits,
      deltaMinorUnits: input.amountMinorUnits,
      currency: account.currency,
      currencyMinorUnitDigits: account.currencyMinorUnitDigits,
      occurredAt: input.occurredAt,
      occurredLocalDate: input.occurredLocalDate,
      occurredLocalTime: input.occurredLocalTime,
      timeZone: input.timeZone,
      reason: null,
      saleId: input.saleId,
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!movement) throw new Error("Sale cash movement insert returned no record");
  return movement;
}

/**
 * Takes a voided sale's payment back out of its account. A protected account that no longer
 * holds the amount refuses, and the whole void rolls back. An account archived since the sale
 * still accepts the reversal, because voiding must undo the complete sale.
 */
export async function reverseSalePaymentCashMovement(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  input: SaleCashOccurrence & { reason: string },
): Promise<CashMovementRecord> {
  const [original] = await tx
    .select()
    .from(cashMovement)
    .where(
      and(
        eq(cashMovement.businessId, access.businessId),
        eq(cashMovement.saleId, input.saleId),
        eq(cashMovement.action, "sale_payment"),
      ),
    )
    .limit(1);
  if (!original) throw new Error("The sale payment has no cash movement to reverse");
  const account = await lockAccount(tx, access.businessId, original.accountId, false);
  requireSufficientBalance(
    account,
    await getAccountBalance(tx, access.businessId, account.id),
    original.amountMinorUnits,
  );
  const [reversal] = await tx
    .insert(cashMovement)
    .values({
      businessId: access.businessId,
      accountId: original.accountId,
      direction: "out",
      action: "reverse",
      amountMinorUnits: original.amountMinorUnits,
      deltaMinorUnits: -original.amountMinorUnits,
      currency: original.currency,
      currencyMinorUnitDigits: original.currencyMinorUnitDigits,
      occurredAt: input.occurredAt,
      occurredLocalDate: input.occurredLocalDate,
      occurredLocalTime: input.occurredLocalTime,
      timeZone: input.timeZone,
      reason: input.reason,
      reversalOfMovementId: original.id,
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!reversal) throw new Error("Sale cash reversal insert returned no record");
  return reversal;
}
