import { parseAmountToMinorUnits } from "@/lib/money";
import type {
  CashAccount,
  ExpenseCategory,
  PostExpenseRequest,
  VoidExpenseRequest,
} from "../../../../../packages/contracts/src/cash.ts";
import { type CashDraftIssue, isValidCashLocalDate } from "../cash/drafts";

export type ExpenseDraftValues = {
  accountId: string;
  category: ExpenseCategory;
  amount: string;
  description: string;
  payee: string;
  localDate: string;
  localTime: string;
};

export type VoidExpenseDraftValues = {
  reason: string;
  localDate: string;
  localTime: string;
};

function validTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function buildExpenseCommand(input: {
  accounts: CashAccount[];
  draft: ExpenseDraftValues;
  idempotencyKey: string;
}): {
  command: PostExpenseRequest | null;
  issues: Partial<Record<keyof ExpenseDraftValues, CashDraftIssue>>;
} {
  const issues: Partial<Record<keyof ExpenseDraftValues, CashDraftIssue>> = {};
  const account = input.accounts.find(
    ({ id, status }) => id === input.draft.accountId && status === "active",
  );
  if (!account) issues.accountId = "account-required";
  const amount = parseAmountToMinorUnits(input.draft.amount, account?.currencyMinorUnitDigits ?? 2);
  if ("error" in amount) issues.amount = "invalid-amount";
  const description = input.draft.description.trim();
  if (!description) issues.description = "required";
  else if (description.length > 240) issues.description = "too-long";
  const payee = input.draft.payee.trim();
  if (payee.length > 120) issues.payee = "too-long";
  if (!isValidCashLocalDate(input.draft.localDate)) issues.localDate = "invalid-date";
  if (!validTime(input.draft.localTime)) issues.localTime = "invalid-time";
  if (Object.keys(issues).length > 0 || !account || "error" in amount) {
    return { command: null, issues };
  }
  return {
    command: {
      accountId: account.id,
      amountMinorUnits: amount.value,
      category: input.draft.category,
      currency: account.currency,
      description,
      idempotencyKey: input.idempotencyKey,
      occurredLocalDate: input.draft.localDate,
      occurredLocalTime: input.draft.localTime,
      ...(payee ? { payee } : {}),
    },
    issues: {},
  };
}

export function buildVoidExpenseCommand(input: {
  draft: VoidExpenseDraftValues;
  idempotencyKey: string;
}): {
  command: VoidExpenseRequest | null;
  issues: Partial<Record<keyof VoidExpenseDraftValues, CashDraftIssue>>;
} {
  const issues: Partial<Record<keyof VoidExpenseDraftValues, CashDraftIssue>> = {};
  const reason = input.draft.reason.trim();
  if (!reason) issues.reason = "required";
  else if (reason.length > 240) issues.reason = "too-long";
  if (!isValidCashLocalDate(input.draft.localDate)) issues.localDate = "invalid-date";
  if (!validTime(input.draft.localTime)) issues.localTime = "invalid-time";
  if (Object.keys(issues).length > 0) return { command: null, issues };
  return {
    command: {
      idempotencyKey: input.idempotencyKey,
      occurredLocalDate: input.draft.localDate,
      occurredLocalTime: input.draft.localTime,
      reason,
    },
    issues: {},
  };
}
