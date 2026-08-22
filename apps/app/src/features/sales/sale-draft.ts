import type { CreateSaleRequest } from "@pisto/contracts";

import { type AmountParseError, parseAmountToMinorUnits } from "@/lib/money";

export type SaleDraftValues = {
  amount: string;
  date: string;
  time: string;
  description: string;
};

export type SaleDraftIssue =
  | AmountParseError
  | "invalid-date"
  | "invalid-time"
  | "description-too-long";

export type SaleDraftIssues = Partial<
  Record<"amount" | "date" | "time" | "description", SaleDraftIssue>
>;

export type SaleDraft = Omit<CreateSaleRequest, "idempotencyKey">;

function isValidCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function validateSaleDraft(
  values: SaleDraftValues,
  currencyMinorUnitDigits: number,
): { draft: SaleDraft | null; issues: SaleDraftIssues } {
  const issues: SaleDraftIssues = {};
  const money = parseAmountToMinorUnits(values.amount, currencyMinorUnitDigits);
  if ("error" in money) issues.amount = money.error;
  if (!isValidCalendarDate(values.date)) issues.date = "invalid-date";
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(values.time)) issues.time = "invalid-time";

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
