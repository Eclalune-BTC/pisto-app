import type {
  PayableState,
  Purchase,
  PurchaseLine,
  Supplier,
  SupplierPayment,
} from "@pisto/contracts";
import {
  entrySourceSchema,
  purchasePaymentTermsSchema,
  purchaseStatusSchema,
  supplierStatusSchema,
} from "@pisto/contracts";

import type {
  PurchaseLineRecord,
  PurchaseRecord,
  SupplierPaymentRecord,
  SupplierRecord,
} from "./types.ts";

/** A purchase is due soon when its balance falls due within this many days of today. */
export const DUE_SOON_DAYS = 7;

/**
 * Exact line cost: the quantity is scaled by the product precision, so the product with the unit
 * cost is divided back by 10^precision and rounded half up. Both factors are non-negative.
 */
export function lineSubtotalMinorUnits(
  quantityMinorUnits: bigint,
  unitCostMinorUnits: bigint,
  quantityPrecision: number,
): bigint {
  if (quantityMinorUnits <= 0n || unitCostMinorUnits < 0n) {
    throw new Error("Purchase line quantity and cost must be positive and non-negative");
  }
  const scale = 10n ** BigInt(quantityPrecision);
  return (quantityMinorUnits * unitCostMinorUnits + scale / 2n) / scale;
}

/** The calendar date `days` after an already validated local date. */
export function addCalendarDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function derivePayable(input: {
  dueDate: string | null;
  localDate: string;
  paidMinorUnits: bigint;
  status: string;
  totalMinorUnits: bigint;
}): { balanceMinorUnits: bigint; state: PayableState } {
  const status = purchaseStatusSchema.parse(input.status);
  const remaining = input.totalMinorUnits - input.paidMinorUnits;
  if (input.paidMinorUnits < 0n || remaining < 0n) {
    throw new Error("Supplier payment history violates the purchase balance invariant");
  }
  // A voided purchase is owed to nobody, whatever it was paid.
  const balanceMinorUnits = status === "voided" ? 0n : remaining;
  if (balanceMinorUnits === 0n) return { balanceMinorUnits, state: "paid" };
  if (input.dueDate !== null && input.dueDate < input.localDate) {
    return { balanceMinorUnits, state: "overdue" };
  }
  if (input.dueDate !== null && input.dueDate <= addCalendarDays(input.localDate, DUE_SOON_DAYS)) {
    return { balanceMinorUnits, state: "due_soon" };
  }
  return { balanceMinorUnits, state: "open" };
}

export function toSupplier(record: SupplierRecord): Supplier {
  return {
    id: record.id,
    name: record.name,
    contactName: record.contactName,
    phone: record.phone,
    email: record.email,
    taxId: record.taxId,
    creditDays: record.creditDays,
    notes: record.notes,
    status: supplierStatusSchema.parse(record.status),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export function toPurchaseLine(record: PurchaseLineRecord): PurchaseLine {
  return {
    id: record.id,
    productId: record.productId,
    productName: record.productName,
    quantityMinorUnits: record.quantityMinorUnits.toString(),
    quantityPrecision: record.quantityPrecision,
    unitCostMinorUnits: record.unitCostMinorUnits.toString(),
    subtotalMinorUnits: record.subtotalMinorUnits.toString(),
  };
}

export function toPurchase(
  record: PurchaseRecord,
  input: {
    lines: readonly PurchaseLineRecord[];
    localDate: string;
    /** Supplier payments only; a cash purchase's own payment is its total. */
    paymentsMinorUnits: bigint;
    supplierName: string;
  },
): Purchase {
  const paymentTerms = purchasePaymentTermsSchema.parse(record.paymentTerms);
  if (input.lines.length === 0) throw new Error("A stored purchase has no lines");
  const paidMinorUnits =
    (paymentTerms === "cash" ? record.totalMinorUnits : 0n) + input.paymentsMinorUnits;
  const { balanceMinorUnits, state } = derivePayable({
    dueDate: record.dueDate,
    localDate: input.localDate,
    paidMinorUnits,
    status: record.status,
    totalMinorUnits: record.totalMinorUnits,
  });
  return {
    id: record.id,
    supplierId: record.supplierId,
    supplierName: input.supplierName,
    invoiceNumber: record.invoiceNumber,
    status: purchaseStatusSchema.parse(record.status),
    entrySource: entrySourceSchema.parse(record.entrySource),
    paymentTerms,
    received: record.receivedAt !== null,
    receivedAt: record.receivedAt?.toISOString() ?? null,
    totalMinorUnits: record.totalMinorUnits.toString(),
    paidMinorUnits: paidMinorUnits.toString(),
    balanceMinorUnits: balanceMinorUnits.toString(),
    payableState: state,
    dueDate: record.dueDate,
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    note: record.note,
    lines: [...input.lines]
      .sort((left, right) => left.position - right.position)
      .map(toPurchaseLine),
    createdAt: record.createdAt.toISOString(),
  };
}

export function toSupplierPayment(record: SupplierPaymentRecord): SupplierPayment {
  return {
    id: record.id,
    purchaseId: record.purchaseId,
    supplierId: record.supplierId,
    accountId: record.cashAccountId,
    amountMinorUnits: record.amountMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    reference: record.reference,
    entrySource: entrySourceSchema.parse(record.entrySource),
    createdAt: record.createdAt.toISOString(),
  };
}
