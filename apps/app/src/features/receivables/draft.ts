import type {
  ApplyReceivablePaymentRequest,
  Customer,
  PostReceivableRequest,
  ReverseReceivablePaymentRequest,
  VoidReceivableRequest,
} from "@pisto/contracts";
import {
  applyReceivablePaymentRequestSchema,
  postReceivableRequestSchema,
  reverseReceivablePaymentRequestSchema,
  voidReceivableRequestSchema,
} from "@pisto/contracts";
import { parseAmountToMinorUnits } from "@/lib/money";

import type { CashAccountChoice } from "./cash-account-source";

export type ReceivableDraftIssue =
  | "amount"
  | "cash-account"
  | "customer"
  | "date"
  | "description"
  | "due-date"
  | "overpayment"
  | "reason"
  | "reference"
  | "time";

export type PostReceivableDraft = {
  amount: string;
  description: string;
  dueDate: string;
  postedDate: string;
};

export type PaymentDraft = {
  amount: string;
  date: string;
  reference: string;
  time: string;
};

export type PaymentReversalDraft = {
  date: string;
  reference: string;
  time: string;
};

type DraftResult<T, TField extends string> =
  | { command: T; issues: Partial<Record<TField, ReceivableDraftIssue>> }
  | { issues: Partial<Record<TField, ReceivableDraftIssue>> };

export function isActualLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function isLocalTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function buildPostReceivableCommand(
  draft: PostReceivableDraft,
  customer: Customer | null,
  currencyMinorUnitDigits: number,
  idempotencyKey: string,
): DraftResult<
  PostReceivableRequest,
  "amount" | "customer" | "description" | "dueDate" | "postedDate"
> {
  const issues: Partial<
    Record<"amount" | "customer" | "description" | "dueDate" | "postedDate", ReceivableDraftIssue>
  > = {};
  const amount = parseAmountToMinorUnits(draft.amount, currencyMinorUnitDigits);
  if ("error" in amount) issues.amount = "amount";
  if (customer?.status !== "active") issues.customer = "customer";
  if (draft.description.trim().length < 1 || draft.description.trim().length > 240) {
    issues.description = "description";
  }
  if (!isActualLocalDate(draft.postedDate)) issues.postedDate = "date";
  if (draft.dueDate && !isActualLocalDate(draft.dueDate)) issues.dueDate = "date";
  if (!issues.postedDate && !issues.dueDate && draft.dueDate && draft.dueDate < draft.postedDate) {
    issues.dueDate = "due-date";
  }
  if (Object.keys(issues).length > 0 || !customer || "error" in amount) return { issues };

  const parsed = postReceivableRequestSchema.safeParse({
    idempotencyKey,
    customerId: customer.id,
    originalMinorUnits: amount.value,
    description: draft.description.trim(),
    postedDate: draft.postedDate,
    dueDate: draft.dueDate || undefined,
  });
  return parsed.success ? { command: parsed.data, issues: {} } : { issues };
}

export function buildPaymentCommand(
  draft: PaymentDraft,
  account: CashAccountChoice | null,
  currencyMinorUnitDigits: number,
  outstandingMinorUnits: string,
  idempotencyKey: string,
): DraftResult<
  ApplyReceivablePaymentRequest,
  "amount" | "cashAccount" | "date" | "reference" | "time"
> {
  const issues: Partial<
    Record<"amount" | "cashAccount" | "date" | "reference" | "time", ReceivableDraftIssue>
  > = {};
  const amount = parseAmountToMinorUnits(draft.amount, currencyMinorUnitDigits);
  if ("error" in amount) issues.amount = "amount";
  if (account?.status !== "active") issues.cashAccount = "cash-account";
  if (!isActualLocalDate(draft.date)) issues.date = "date";
  if (!isLocalTime(draft.time)) issues.time = "time";
  if (draft.reference.trim().length > 120) issues.reference = "reference";
  if (!("error" in amount) && BigInt(amount.value) > BigInt(outstandingMinorUnits)) {
    issues.amount = "overpayment";
  }
  if (Object.keys(issues).length > 0 || !account || "error" in amount) return { issues };

  const parsed = applyReceivablePaymentRequestSchema.safeParse({
    idempotencyKey,
    amountMinorUnits: amount.value,
    occurredLocalDate: draft.date,
    occurredLocalTime: draft.time,
    cashAccountId: account.id,
    reference: draft.reference.trim() || undefined,
  });
  return parsed.success ? { command: parsed.data, issues: {} } : { issues };
}

export function buildPaymentReversalCommand(
  draft: PaymentReversalDraft,
  idempotencyKey: string,
): DraftResult<ReverseReceivablePaymentRequest, "date" | "reference" | "time"> {
  const issues: Partial<Record<"date" | "reference" | "time", ReceivableDraftIssue>> = {};
  if (!isActualLocalDate(draft.date)) issues.date = "date";
  if (!isLocalTime(draft.time)) issues.time = "time";
  if (draft.reference.trim().length > 120) issues.reference = "reference";
  if (Object.keys(issues).length > 0) return { issues };
  const parsed = reverseReceivablePaymentRequestSchema.safeParse({
    idempotencyKey,
    occurredLocalDate: draft.date,
    occurredLocalTime: draft.time,
    reference: draft.reference.trim() || undefined,
  });
  return parsed.success ? { command: parsed.data, issues: {} } : { issues };
}

export function buildVoidReceivableCommand(
  reason: string,
  idempotencyKey: string,
): DraftResult<VoidReceivableRequest, "reason"> {
  const parsed = voidReceivableRequestSchema.safeParse({ idempotencyKey, reason: reason.trim() });
  return parsed.success ? { command: parsed.data, issues: {} } : { issues: { reason: "reason" } };
}
