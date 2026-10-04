import type { Receivable, ReceivablePayment } from "@pisto/contracts";

import { isPositiveAmount } from "@/features/customers/format";

/** Payments are accepted while money is owed and the customer can still receive them. */
export function acceptsPayment(receivable: Receivable, customerActive: boolean): boolean {
  return (
    customerActive &&
    (receivable.state === "open" || receivable.state === "overdue") &&
    isPositiveAmount(receivable.outstandingMinorUnits)
  );
}

/** A charge can be voided only while posted and with no net payment left on it. */
export function acceptsVoid(receivable: Receivable): boolean {
  return receivable.state !== "voided" && !isPositiveAmount(receivable.paidMinorUnits);
}

export function isReversed(
  payment: ReceivablePayment,
  payments: readonly ReceivablePayment[],
): boolean {
  return payments.some(
    (candidate) => candidate.kind === "reversal" && candidate.reversesPaymentId === payment.id,
  );
}
