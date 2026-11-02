import { and, eq } from "drizzle-orm";

import type { AuthorizedBusinessContext, DatabaseTransaction } from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { cashMovement } from "../schema/cash.ts";
import { getAccountBalance, lockAccount, requireSufficientBalance } from "./records.ts";
import type { CashAccountRecord, CashMovementRecord } from "./types.ts";

interface Occurrence {
  occurredAt: Date;
  occurredLocalDate: string;
  occurredLocalTime: string;
}

/**
 * Locks the selected account and proves it can pay `amountMinorUnits` in the business currency.
 * Purchases call it before inserting the records that reference the account, so a foreign or
 * archived account is a product error rather than a foreign-key failure.
 */
export async function requirePurchaseOutflowAccount(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  accountId: string,
  amountMinorUnits: bigint,
): Promise<CashAccountRecord> {
  const account = await lockAccount(tx, access.businessId, accountId, true);
  if (
    account.currency !== access.currency ||
    account.currencyMinorUnitDigits !== access.currencyMinorUnitDigits
  ) {
    throw new ProductError("CONFLICT", "The selected cash account uses a different currency");
  }
  requireSufficientBalance(
    account,
    await getAccountBalance(tx, access.businessId, account.id),
    amountMinorUnits,
  );
  return account;
}

/** Pays a cash purchase in full, or a supplier payment, out of one account. */
export async function appendPurchaseCashMovement(
  tx: DatabaseTransaction,
  input: Occurrence & {
    access: AuthorizedBusinessContext;
    accountId: string;
    actorUserId: string;
    amountMinorUnits: bigint;
    source: { purchaseId: string } | { supplierPaymentId: string };
  },
): Promise<CashMovementRecord> {
  const account = await requirePurchaseOutflowAccount(
    tx,
    input.access,
    input.accountId,
    input.amountMinorUnits,
  );
  const [movement] = await tx
    .insert(cashMovement)
    .values({
      businessId: input.access.businessId,
      accountId: account.id,
      direction: "out",
      action: "purchaseId" in input.source ? "purchase_payment" : "supplier_payment",
      amountMinorUnits: input.amountMinorUnits,
      deltaMinorUnits: -input.amountMinorUnits,
      currency: account.currency,
      currencyMinorUnitDigits: account.currencyMinorUnitDigits,
      occurredAt: input.occurredAt,
      occurredLocalDate: input.occurredLocalDate,
      occurredLocalTime: input.occurredLocalTime,
      timeZone: input.access.timeZone,
      reason: null,
      purchaseId: "purchaseId" in input.source ? input.source.purchaseId : null,
      supplierPaymentId:
        "supplierPaymentId" in input.source ? input.source.supplierPaymentId : null,
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!movement) throw new Error("Purchase cash movement insert returned no record");
  return movement;
}

/** Returns the money of a voided cash purchase to the account it was paid from. */
export async function reversePurchaseCashMovement(
  tx: DatabaseTransaction,
  input: Occurrence & {
    access: AuthorizedBusinessContext;
    actorUserId: string;
    purchaseId: string;
    reason: string;
  },
): Promise<CashMovementRecord> {
  const [original] = await tx
    .select()
    .from(cashMovement)
    .where(
      and(
        eq(cashMovement.businessId, input.access.businessId),
        eq(cashMovement.purchaseId, input.purchaseId),
        eq(cashMovement.action, "purchase_payment"),
      ),
    )
    .limit(1)
    .for("update");
  if (!original) throw new Error("A cash purchase has no matching cash movement");
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
    throw new ProductError("CONFLICT", "The purchase payment is already reversed");
  }
  await lockAccount(tx, input.access.businessId, original.accountId, false);
  const [reversal] = await tx
    .insert(cashMovement)
    .values({
      businessId: input.access.businessId,
      accountId: original.accountId,
      direction: "in",
      action: "reverse",
      amountMinorUnits: original.amountMinorUnits,
      deltaMinorUnits: original.amountMinorUnits,
      currency: original.currency,
      currencyMinorUnitDigits: original.currencyMinorUnitDigits,
      occurredAt: input.occurredAt,
      occurredLocalDate: input.occurredLocalDate,
      occurredLocalTime: input.occurredLocalTime,
      timeZone: input.access.timeZone,
      reason: input.reason,
      reversalOfMovementId: original.id,
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!reversal) throw new Error("Purchase cash reversal insert returned no record");
  return reversal;
}
