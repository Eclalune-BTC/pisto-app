import { type CreateSaleRequest, calendarLocalDateSchema, localTimeSchema } from "@pisto/contracts";
import type { TFunction } from "i18next";

import { type AmountParseError, parseAmountToMinorUnits } from "@/lib/money";

export type SaleDraftValues = {
  amount: string;
  date: string;
  time: string;
  description: string;
};

export type SaleDraftIssue =
  | AmountParseError
  | "missing-amount"
  | "invalid-date"
  | "invalid-time"
  | "description-too-long";

export type SaleDraftIssues = Partial<Record<keyof SaleDraftValues, SaleDraftIssue>>;

export type SaleDraftErrors = Partial<Record<keyof SaleDraftValues, string>>;

export type SaleDraft = Omit<CreateSaleRequest, "idempotencyKey">;

export const emptySaleDraft: SaleDraftValues = { amount: "", date: "", time: "", description: "" };

export function validateSaleDraft(
  values: SaleDraftValues,
  currencyMinorUnitDigits: number,
): { draft: SaleDraft | null; issues: SaleDraftIssues } {
  const issues: SaleDraftIssues = {};
  const money = parseAmountToMinorUnits(values.amount, currencyMinorUnitDigits);
  if ("error" in money) issues.amount = values.amount.trim() ? money.error : "missing-amount";
  if (!calendarLocalDateSchema.safeParse(values.date).success) issues.date = "invalid-date";
  if (!localTimeSchema.safeParse(values.time).success) issues.time = "invalid-time";

  const description = values.description.trim();
  if (description.length > 240) issues.description = "description-too-long";
  if (Object.keys(issues).length > 0 || "error" in money) return { draft: null, issues };

  return {
    draft: {
      grossMinorUnits: money.value,
      occurredLocalDate: values.date,
      occurredLocalTime: values.time,
      ...(description ? { description } : {}),
    },
    issues,
  };
}

export function saleDraftErrors(
  issues: SaleDraftIssues,
  currencyMinorUnitDigits: number,
  t: TFunction,
): SaleDraftErrors {
  const messages: Record<SaleDraftIssue, string> = {
    "missing-amount": t("sales.validation.amountRequired"),
    "invalid-decimals": t("sales.validation.amountDecimals", { count: currencyMinorUnitDigits }),
    "invalid-integer": t("sales.validation.amountInteger"),
    "non-positive": t("sales.validation.amountPositive"),
    "too-large": t("sales.validation.amountTooLarge"),
    "invalid-date": t("sales.validation.date"),
    "invalid-time": t("sales.validation.time"),
    "description-too-long": t("sales.validation.description"),
  };
  const errors: SaleDraftErrors = {};
  for (const field of Object.keys(issues) as (keyof SaleDraftValues)[]) {
    const issue = issues[field];
    if (issue) errors[field] = messages[issue];
  }
  return errors;
}
