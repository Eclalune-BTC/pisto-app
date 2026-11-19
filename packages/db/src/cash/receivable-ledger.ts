import { and, eq } from "drizzle-orm";

import type { AuthorizedBusinessContext, DatabaseTransaction } from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { cashAccount, cashMovement } from "../schema/cash.ts";
import { getAccountBalance, lockAccount, requireSufficientBalance } from "./records.ts";
import type { CashMovementRecord } from "./types.ts";

interface ReceivableCashMovementInput {
  access: AuthorizedBusinessContext;
  accountId: string;
  actorUserId: string;
  amountMinorUnits: bigint;
  currency: string;
  currencyMinorUnitDigits: number;
  occurredAt: Date;
  occurredLocalDate: string;
  occurredLocalTime: string;
  receivablePaymentId: string;
}

function requireMatchingMoneySnapshot(
  access: AuthorizedBusinessContext,
  input: Pick<ReceivableCashMovementInput, "currency" | "currencyMinorUnitDigits">,
): void {
  if (
    input.currency !== access.currency ||
    input.currencyMinorUnitDigits !== access.currencyMinorUnitDigits
  ) {
    throw new ProductError(
      "CONFLICT",
      "The receivable payment currency does not match the business cash ledger",
    );
  }
}

/**
 * A payment row references its account by foreign key, so an account that is not in the business
 * is refused here, before that insert, as a product error. It takes no lock: accounts are never
 * deleted, and the lock with the active and currency checks belongs to the cash movement, which
 * concurrent payments into one account take only after their own payment insert.
 */
export async function requireBusinessCashAccount(
  tx: DatabaseTransaction,
  businessId: string,
  accountId: string,
): Promise<void> {
  const [found] = await tx
    .select({ id: cashAccount.id })
    .from(cashAccount)
    .where(and(eq(cashAccount.businessId, businessId), eq(cashAccount.id, accountId)))
    .limit(1);
  if (!found) throw new ProductError("NOT_FOUND", "Cash account was not found");
}

export async function appendReceivablePaymentCashMovement(
  tx: DatabaseTransaction,
  input: ReceivableCashMovementInput,
): Promise<CashMovementRecord> {
  requireMatchingMoneySnapshot(input.access, input);
  const account = await lockAccount(tx, input.access.businessId, input.accountId, true);
  if (
    account.currency !== input.currency ||
    account.currencyMinorUnitDigits !== input.currencyMinorUnitDigits
  ) {
    throw new ProductError("CONFLICT", "The selected cash account uses a different currency");
  }
  const [movement] = await tx
    .insert(cashMovement)
    .values({
      businessId: input.access.businessId,
      accountId: account.id,
      direction: "in",
      action: "receivable_payment",
      amountMinorUnits: input.amountMinorUnits,
      deltaMinorUnits: input.amountMinorUnits,
      currency: input.currency,
      currencyMinorUnitDigits: input.currencyMinorUnitDigits,
      occurredAt: input.occurredAt,
      occurredLocalDate: input.occurredLocalDate,
      occurredLocalTime: input.occurredLocalTime,
      timeZone: input.access.timeZone,
      reason: null,
      receivablePaymentId: input.receivablePaymentId,
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!movement) throw new Error("Receivable cash movement insert returned no record");
  return movement;
}

export async function reverseReceivablePaymentCashMovement(
  tx: DatabaseTransaction,
  input: {
    access: AuthorizedBusinessContext;
    actorUserId: string;
    occurredAt: Date;
    occurredLocalDate: string;
    occurredLocalTime: string;
    originalReceivablePaymentId: string;
  },
): Promise<CashMovementRecord> {
  const [original] = await tx
    .select()
    .from(cashMovement)
    .where(
      and(
        eq(cashMovement.businessId, input.access.businessId),
        eq(cashMovement.receivablePaymentId, input.originalReceivablePaymentId),
        eq(cashMovement.action, "receivable_payment"),
      ),
    )
    .limit(1)
    .for("update");
  // A payment and its cash movement commit together, so a missing movement is a broken ledger.
  if (!original) throw new Error("The receivable payment has no cash movement to reverse");
  const [priorReversal] = await tx
    .select({ id: cashMovement.id })
    .from(cashMovement)
    .where(
      and(
        eq(cashMovement.businessId, input.access.businessId),
        eq(cashMovement.reversalOfMovementId, original.id),
      ),
    )
    .limit(1);
  if (priorReversal) {
    throw new ProductError("CONFLICT", "The payment cash movement is already reversed");
  }
  const account = await lockAccount(tx, input.access.businessId, original.accountId, true);
  requireSufficientBalance(
    account,
    await getAccountBalance(tx, input.access.businessId, account.id),
    original.amountMinorUnits,
  );
  const [reversal] = await tx
    .insert(cashMovement)
    .values({
      businessId: input.access.businessId,
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
      timeZone: input.access.timeZone,
      reason: null,
      reversalOfMovementId: original.id,
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!reversal) throw new Error("Receivable cash reversal insert returned no record");
  return reversal;
}
