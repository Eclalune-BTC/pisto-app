import type {
  CashAccount,
  CashAccountKind,
  CashMovementDirection,
  CreateCashAccountRequest,
  RecordCashAdjustmentRequest,
  ReverseCashMovementRequest,
  TransferCashRequest,
  UpdateCashAccountRequest,
} from "@pisto/contracts";
import { parseAmountToMinorUnits } from "@/lib/money";

export type CashDraftIssue =
  | "required"
  | "too-long"
  | "invalid-amount"
  | "invalid-date"
  | "invalid-time"
  | "account-required"
  | "accounts-must-differ"
  | "no-changes";

export type AccountDraftValues = {
  name: string;
  kind: CashAccountKind;
  negativePolicy: "protected" | "allowed";
  openingMode: "zero" | CashMovementDirection;
  openingAmount: string;
  openingReason: string;
  openingLocalDate: string;
  openingLocalTime: string;
};

export type AdjustmentDraftValues = {
  accountId: string;
  direction: CashMovementDirection;
  amount: string;
  reason: string;
  localDate: string;
  localTime: string;
};

export type TransferDraftValues = {
  fromAccountId: string;
  toAccountId: string;
  amount: string;
  note: string;
  localDate: string;
  localTime: string;
};

export type ReversalDraftValues = {
  reason: string;
  localDate: string;
  localTime: string;
};

function isValidDate(value: string): boolean {
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

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validateText(
  value: string,
  maximum: number,
  required: boolean,
): { value?: string; issue?: CashDraftIssue } {
  const trimmed = value.trim();
  if (!trimmed) return required ? { issue: "required" } : {};
  if (trimmed.length > maximum) return { issue: "too-long" };
  return { value: trimmed };
}

function validateDateTime(
  localDate: string,
  localTime: string,
): { localDate?: CashDraftIssue; localTime?: CashDraftIssue } {
  return {
    localDate: isValidDate(localDate) ? undefined : "invalid-date",
    localTime: isValidTime(localTime) ? undefined : "invalid-time",
  };
}

export function buildCashAccountCommand(input: {
  account: CashAccount | null;
  currency: string;
  currencyMinorUnitDigits: number;
  draft: AccountDraftValues;
  idempotencyKey: string;
  mode: "create" | "update";
}): {
  command: CreateCashAccountRequest | UpdateCashAccountRequest | null;
  issues: Partial<Record<keyof AccountDraftValues | "form", CashDraftIssue>>;
} {
  const name = validateText(input.draft.name, 80, true);
  const issues: Partial<Record<keyof AccountDraftValues | "form", CashDraftIssue>> = {};
  if (name.issue) issues.name = name.issue;

  if (input.mode === "update") {
    if (!input.account) return { command: null, issues: { form: "account-required" } };
    if (Object.keys(issues).length > 0 || !name.value) return { command: null, issues };
    const command: UpdateCashAccountRequest = { idempotencyKey: input.idempotencyKey };
    if (name.value !== input.account.name) command.name = name.value;
    if (input.draft.kind !== input.account.kind) command.kind = input.draft.kind;
    const allowNegativeBalance = input.draft.negativePolicy === "allowed";
    if (allowNegativeBalance !== input.account.allowNegativeBalance) {
      command.allowNegativeBalance = allowNegativeBalance;
    }
    if (Object.keys(command).length === 1) {
      return { command: null, issues: { form: "no-changes" } };
    }
    return { command, issues: {} };
  }

  let opening: CreateCashAccountRequest["opening"] = null;
  if (input.draft.openingMode !== "zero") {
    const amount = parseAmountToMinorUnits(
      input.draft.openingAmount,
      input.currencyMinorUnitDigits,
    );
    const reason = validateText(input.draft.openingReason, 240, true);
    const dateTimeIssues = validateDateTime(
      input.draft.openingLocalDate,
      input.draft.openingLocalTime,
    );
    if ("error" in amount) issues.openingAmount = "invalid-amount";
    if (reason.issue) issues.openingReason = reason.issue;
    if (dateTimeIssues.localDate) issues.openingLocalDate = dateTimeIssues.localDate;
    if (dateTimeIssues.localTime) issues.openingLocalTime = dateTimeIssues.localTime;
    if (!("error" in amount) && reason.value && Object.keys(issues).length === 0) {
      opening = {
        amountMinorUnits: amount.value,
        direction: input.draft.openingMode,
        occurredLocalDate: input.draft.openingLocalDate,
        occurredLocalTime: input.draft.openingLocalTime,
        reason: reason.value,
      };
    }
  }

  if (Object.keys(issues).length > 0 || !name.value) return { command: null, issues };
  return {
    command: {
      allowNegativeBalance: input.draft.negativePolicy === "allowed",
      currency: input.currency,
      idempotencyKey: input.idempotencyKey,
      kind: input.draft.kind,
      name: name.value,
      opening,
    },
    issues: {},
  };
}

export function buildCashAdjustmentCommand(input: {
  account: CashAccount | undefined;
  draft: AdjustmentDraftValues;
  idempotencyKey: string;
}): {
  command: RecordCashAdjustmentRequest | null;
  issues: Partial<Record<keyof AdjustmentDraftValues, CashDraftIssue>>;
} {
  const issues: Partial<Record<keyof AdjustmentDraftValues, CashDraftIssue>> = {};
  if (input.account?.status !== "active") issues.accountId = "account-required";
  const amount = parseAmountToMinorUnits(
    input.draft.amount,
    input.account?.currencyMinorUnitDigits ?? 2,
  );
  if ("error" in amount) issues.amount = "invalid-amount";
  const reason = validateText(input.draft.reason, 240, true);
  if (reason.issue) issues.reason = reason.issue;
  const dateTimeIssues = validateDateTime(input.draft.localDate, input.draft.localTime);
  if (dateTimeIssues.localDate) issues.localDate = dateTimeIssues.localDate;
  if (dateTimeIssues.localTime) issues.localTime = dateTimeIssues.localTime;
  if (Object.keys(issues).length > 0 || !input.account || "error" in amount || !reason.value) {
    return { command: null, issues };
  }
  return {
    command: {
      accountId: input.account.id,
      amountMinorUnits: amount.value,
      currency: input.account.currency,
      direction: input.draft.direction,
      idempotencyKey: input.idempotencyKey,
      occurredLocalDate: input.draft.localDate,
      occurredLocalTime: input.draft.localTime,
      reason: reason.value,
    },
    issues: {},
  };
}

export function buildCashTransferCommand(input: {
  accounts: CashAccount[];
  draft: TransferDraftValues;
  idempotencyKey: string;
}): {
  command: TransferCashRequest | null;
  issues: Partial<Record<keyof TransferDraftValues, CashDraftIssue>>;
} {
  const issues: Partial<Record<keyof TransferDraftValues, CashDraftIssue>> = {};
  const fromAccount = input.accounts.find(
    ({ id, status }) => id === input.draft.fromAccountId && status === "active",
  );
  const toAccount = input.accounts.find(
    ({ id, status }) => id === input.draft.toAccountId && status === "active",
  );
  if (!fromAccount) issues.fromAccountId = "account-required";
  if (!toAccount) issues.toAccountId = "account-required";
  if (fromAccount && toAccount && fromAccount.id === toAccount.id) {
    issues.toAccountId = "accounts-must-differ";
  }
  const amount = parseAmountToMinorUnits(
    input.draft.amount,
    fromAccount?.currencyMinorUnitDigits ?? 2,
  );
  if ("error" in amount) issues.amount = "invalid-amount";
  const note = validateText(input.draft.note, 240, false);
  if (note.issue) issues.note = note.issue;
  const dateTimeIssues = validateDateTime(input.draft.localDate, input.draft.localTime);
  if (dateTimeIssues.localDate) issues.localDate = dateTimeIssues.localDate;
  if (dateTimeIssues.localTime) issues.localTime = dateTimeIssues.localTime;
  if (Object.keys(issues).length > 0 || !fromAccount || !toAccount || "error" in amount) {
    return { command: null, issues };
  }
  return {
    command: {
      amountMinorUnits: amount.value,
      currency: fromAccount.currency,
      fromAccountId: fromAccount.id,
      idempotencyKey: input.idempotencyKey,
      ...(note.value ? { note: note.value } : {}),
      occurredLocalDate: input.draft.localDate,
      occurredLocalTime: input.draft.localTime,
      toAccountId: toAccount.id,
    },
    issues: {},
  };
}

export function buildCashReversalCommand(input: {
  draft: ReversalDraftValues;
  idempotencyKey: string;
}): {
  command: ReverseCashMovementRequest | null;
  issues: Partial<Record<keyof ReversalDraftValues, CashDraftIssue>>;
} {
  const issues: Partial<Record<keyof ReversalDraftValues, CashDraftIssue>> = {};
  const reason = validateText(input.draft.reason, 240, true);
  if (reason.issue) issues.reason = reason.issue;
  const dateTimeIssues = validateDateTime(input.draft.localDate, input.draft.localTime);
  if (dateTimeIssues.localDate) issues.localDate = dateTimeIssues.localDate;
  if (dateTimeIssues.localTime) issues.localTime = dateTimeIssues.localTime;
  if (Object.keys(issues).length > 0 || !reason.value) return { command: null, issues };
  return {
    command: {
      idempotencyKey: input.idempotencyKey,
      occurredLocalDate: input.draft.localDate,
      occurredLocalTime: input.draft.localTime,
      reason: reason.value,
    },
    issues: {},
  };
}

export function isValidCashLocalDate(value: string): boolean {
  return isValidDate(value);
}
