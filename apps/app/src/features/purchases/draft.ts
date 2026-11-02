import type {
  CreatePurchaseRequest,
  CreateSupplierPaymentRequest,
  EntrySource,
  PurchasePaymentTerms,
} from "@pisto/contracts";
import {
  calendarLocalDateSchema,
  createPurchaseRequestSchema,
  createSupplierPaymentRequestSchema,
  localTimeSchema,
} from "@pisto/contracts";

import { parseAmountToMinorUnits } from "@/lib/money";

export type PurchaseDraftIssue =
  | "account"
  | "amount"
  | "date"
  | "due-before-date"
  | "invoice"
  | "lines"
  | "overpayment"
  | "quantity"
  | "reference"
  | "supplier"
  | "time"
  | "total"
  | "unit-cost";

export type Choice = { id: string; name: string };

export type PurchaseLineDraft = {
  /** Stable row identity while lines are added and removed. */
  key: string;
  productId: string;
  productName: string;
  quantityPrecision: number;
  quantity: string;
  unitCost: string;
};

export type PurchaseDraft = {
  account: Choice | null;
  date: string;
  dueDate: string;
  invoiceNumber: string;
  lines: PurchaseLineDraft[];
  paymentTerms: PurchasePaymentTerms;
  received: boolean;
  supplier: (Choice & { creditDays: number | null }) | null;
  time: string;
};

export type PurchaseDraftIssues = {
  account?: PurchaseDraftIssue;
  date?: PurchaseDraftIssue;
  dueDate?: PurchaseDraftIssue;
  invoiceNumber?: PurchaseDraftIssue;
  /** Keyed by line `key`. */
  lineCosts?: Record<string, PurchaseDraftIssue>;
  lineQuantities?: Record<string, PurchaseDraftIssue>;
  lines?: PurchaseDraftIssue;
  supplier?: PurchaseDraftIssue;
  time?: PurchaseDraftIssue;
};

/** The calendar date `days` after a valid local date. */
export function addCalendarDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** The due date a credit purchase starts with: the purchase date plus the supplier's credit days. */
export function defaultDueDate(purchaseDate: string, creditDays: number | null): string {
  if (!calendarLocalDateSchema.safeParse(purchaseDate).success) return purchaseDate;
  return addCalendarDays(purchaseDate, creditDays ?? 0);
}

/** Quantity text scaled by the product precision, like the inventory ledger. */
export function parseQuantity(text: string, quantityPrecision: number): string | null {
  const parsed = parseAmountToMinorUnits(text, quantityPrecision);
  return "value" in parsed ? parsed.value : null;
}

export function parseUnitCost(text: string, currencyMinorUnitDigits: number): string | null {
  const parsed = parseAmountToMinorUnits(text, currencyMinorUnitDigits, { allowZero: true });
  return "value" in parsed ? parsed.value : null;
}

/**
 * The preview of a line cost before saving: the same exact rule the server applies (quantity ×
 * cost / 10^precision, half up). The saved purchase carries the server's figures.
 */
export function previewSubtotal(
  line: Pick<PurchaseLineDraft, "quantity" | "quantityPrecision" | "unitCost">,
  currencyMinorUnitDigits: number,
): string | null {
  const quantity = parseQuantity(line.quantity, line.quantityPrecision);
  const cost = parseUnitCost(line.unitCost, currencyMinorUnitDigits);
  if (quantity === null || cost === null) return null;
  const scale = 10n ** BigInt(line.quantityPrecision);
  return ((BigInt(quantity) * BigInt(cost) + scale / 2n) / scale).toString();
}

/** The total preview, or null while any line is incomplete. */
export function previewTotal(
  lines: readonly PurchaseLineDraft[],
  currencyMinorUnitDigits: number,
): string | null {
  if (lines.length === 0) return null;
  let total = 0n;
  for (const line of lines) {
    const subtotal = previewSubtotal(line, currencyMinorUnitDigits);
    if (subtotal === null) return null;
    total += BigInt(subtotal);
  }
  return total.toString();
}

export function buildPurchaseCommand(
  draft: PurchaseDraft,
  input: {
    currencyMinorUnitDigits: number;
    entrySource: EntrySource;
    idempotencyKey: string;
  },
):
  | { command: CreatePurchaseRequest; issues: PurchaseDraftIssues }
  | { issues: PurchaseDraftIssues } {
  const issues: PurchaseDraftIssues = {};
  if (!draft.supplier) issues.supplier = "supplier";
  if (!calendarLocalDateSchema.safeParse(draft.date).success) issues.date = "date";
  if (!localTimeSchema.safeParse(draft.time).success) issues.time = "time";
  const invoiceNumber = draft.invoiceNumber.trim();
  if (invoiceNumber.length > 40) issues.invoiceNumber = "invoice";
  if (draft.lines.length === 0) issues.lines = "lines";
  const lineQuantities: Record<string, PurchaseDraftIssue> = {};
  const lineCosts: Record<string, PurchaseDraftIssue> = {};
  const lines: CreatePurchaseRequest["lines"] = [];
  for (const line of draft.lines) {
    const quantity = parseQuantity(line.quantity, line.quantityPrecision);
    const cost = parseUnitCost(line.unitCost, input.currencyMinorUnitDigits);
    if (quantity === null) lineQuantities[line.key] = "quantity";
    if (cost === null) lineCosts[line.key] = "unit-cost";
    if (quantity !== null && cost !== null) {
      lines.push({
        productId: line.productId,
        quantityMinorUnits: quantity,
        unitCostMinorUnits: cost,
      });
    }
  }
  if (Object.keys(lineQuantities).length > 0) issues.lineQuantities = lineQuantities;
  if (Object.keys(lineCosts).length > 0) issues.lineCosts = lineCosts;
  const total = previewTotal(draft.lines, input.currencyMinorUnitDigits);
  if (!issues.lines && total === "0") issues.lines = "total";
  if (draft.paymentTerms === "cash" && !draft.account) issues.account = "account";
  if (draft.paymentTerms === "credit") {
    if (!calendarLocalDateSchema.safeParse(draft.dueDate).success) issues.dueDate = "date";
    else if (!issues.date && draft.dueDate < draft.date) issues.dueDate = "due-before-date";
  }
  if (Object.keys(issues).length > 0 || !draft.supplier) return { issues };
  const parsed = createPurchaseRequestSchema.safeParse({
    idempotencyKey: input.idempotencyKey,
    supplierId: draft.supplier.id,
    ...(invoiceNumber ? { invoiceNumber } : {}),
    occurredLocalDate: draft.date,
    occurredLocalTime: draft.time,
    lines,
    received: draft.received,
    paymentTerms: draft.paymentTerms,
    ...(draft.paymentTerms === "cash" && draft.account
      ? { accountId: draft.account.id }
      : { dueDate: draft.dueDate }),
    entrySource: input.entrySource,
  });
  if (!parsed.success) throw new Error("A validated purchase draft does not match its contract");
  return { command: parsed.data, issues };
}

export type SupplierPaymentDraft = {
  account: Choice | null;
  amount: string;
  date: string;
  reference: string;
  time: string;
};

export type SupplierPaymentIssues = Partial<
  Record<"account" | "amount" | "date" | "reference" | "time", PurchaseDraftIssue>
>;

/** The balance preview after the typed amount, or null while the amount is not valid. */
export function balanceAfterPayment(
  balanceMinorUnits: string,
  amountText: string,
  currencyMinorUnitDigits: number,
): string | null {
  const amount = parseAmountToMinorUnits(amountText, currencyMinorUnitDigits);
  if (!("value" in amount)) return null;
  const after = BigInt(balanceMinorUnits) - BigInt(amount.value);
  return after < 0n ? null : after.toString();
}

export function buildSupplierPaymentCommand(
  draft: SupplierPaymentDraft,
  input: {
    balanceMinorUnits: string;
    currencyMinorUnitDigits: number;
    entrySource: EntrySource;
    idempotencyKey: string;
  },
):
  | { command: CreateSupplierPaymentRequest; issues: SupplierPaymentIssues }
  | { issues: SupplierPaymentIssues } {
  const issues: SupplierPaymentIssues = {};
  const amount = parseAmountToMinorUnits(draft.amount, input.currencyMinorUnitDigits);
  if (!("value" in amount)) issues.amount = "amount";
  else if (BigInt(amount.value) > BigInt(input.balanceMinorUnits)) issues.amount = "overpayment";
  if (!draft.account) issues.account = "account";
  if (!calendarLocalDateSchema.safeParse(draft.date).success) issues.date = "date";
  if (!localTimeSchema.safeParse(draft.time).success) issues.time = "time";
  const reference = draft.reference.trim();
  if (reference.length > 120) issues.reference = "reference";
  if (Object.keys(issues).length > 0 || !draft.account || !("value" in amount)) return { issues };
  const parsed = createSupplierPaymentRequestSchema.safeParse({
    idempotencyKey: input.idempotencyKey,
    accountId: draft.account.id,
    amountMinorUnits: amount.value,
    occurredLocalDate: draft.date,
    occurredLocalTime: draft.time,
    ...(reference ? { reference } : {}),
    entrySource: input.entrySource,
  });
  if (!parsed.success) throw new Error("A validated payment draft does not match its contract");
  return { command: parsed.data, issues };
}
