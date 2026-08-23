import { and, eq } from "drizzle-orm";

import type { AuthorizedBusinessContext } from "../business-access.ts";
import { ProductError } from "../product.ts";
import { cashMovement } from "../schema/cash.ts";
import { getAccountBalance, lockAccount, requireSufficientBalance } from "./access.ts";
import type { CashMovementRecord, CashTransaction } from "./types.ts";

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

export async function appendReceivablePaymentCashMovement(
  tx: CashTransaction,
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
      reason: "Receivable payment",
      receivablePaymentId: input.receivablePaymentId,
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!movement) throw new Error("Receivable cash movement insert returned no record");
  return movement;
}

export async function reverseReceivablePaymentCashMovement(
  tx: CashTransaction,
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
  if (!original) {
    throw new ProductError("CONFLICT", "The payment has no matching cash movement to reverse");
  }
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
      reason: "Receivable payment reversal",
      reversalOfMovementId: original.id,
      createdByUserId: input.actorUserId,
    })
    .returning();
  if (!reversal) throw new Error("Receivable cash reversal insert returned no record");
  return reversal;
}
