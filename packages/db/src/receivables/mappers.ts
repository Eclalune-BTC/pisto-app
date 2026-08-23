import type { Customer, Receivable, ReceivablePayment } from "@pisto/contracts";

import type { CustomerRecord, PaymentRecord, ReceivableRecord } from "./types.ts";

export function toCustomer(record: CustomerRecord): Customer {
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    email: record.email,
    notes: record.notes,
    status: record.status === "archived" ? "archived" : "active",
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toPayment(record: PaymentRecord): ReceivablePayment {
  return {
    id: record.id,
    receivableId: record.receivableId,
    customerId: record.customerId,
    kind: record.kind === "reversal" ? "reversal" : "payment",
    amountMinorUnits: record.amountMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    cashAccountId: record.cashAccountId,
    reference: record.reference,
    reversesPaymentId: record.reversesPaymentId,
    createdAt: record.createdAt.toISOString(),
  };
}

export function deriveReceivableBalance(input: {
  dueDate: string | null;
  localDate: string;
  originalMinorUnits: bigint;
  paidMinorUnits: bigint;
  status: string;
}): { outstandingMinorUnits: bigint; state: Receivable["state"] } {
  const outstandingMinorUnits =
    input.status === "voided" ? 0n : input.originalMinorUnits - input.paidMinorUnits;
  if (input.paidMinorUnits < 0n || outstandingMinorUnits < 0n) {
    throw new Error("Receivable payment history violates the outstanding balance invariant");
  }
  const state =
    input.status === "voided"
      ? ("voided" as const)
      : outstandingMinorUnits === 0n
        ? ("paid" as const)
        : input.dueDate !== null && input.dueDate < input.localDate
          ? ("overdue" as const)
          : ("open" as const);
  return { outstandingMinorUnits, state };
}

export function toReceivable(
  record: ReceivableRecord,
  paidMinorUnits: bigint,
  localDate: string,
): Receivable {
  const { outstandingMinorUnits, state } = deriveReceivableBalance({
    dueDate: record.dueDate,
    localDate,
    originalMinorUnits: record.originalMinorUnits,
    paidMinorUnits,
    status: record.status,
  });
  return {
    id: record.id,
    customerId: record.customerId,
    state,
    originalMinorUnits: record.originalMinorUnits.toString(),
    paidMinorUnits: paidMinorUnits.toString(),
    outstandingMinorUnits: outstandingMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    description: record.description,
    postedDate: record.postedDate,
    dueDate: record.dueDate,
    voidedAt: record.voidedAt?.toISOString() ?? null,
    voidReason: record.voidReason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
