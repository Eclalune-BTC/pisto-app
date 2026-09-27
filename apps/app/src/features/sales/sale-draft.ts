import { type CreateSaleRequest, calendarLocalDateSchema, localTimeSchema } from "@pisto/contracts";

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

export function validateSaleDraft(
  values: SaleDraftValues,
  currencyMinorUnitDigits: number,
): { draft: SaleDraft | null; issues: SaleDraftIssues } {
  const issues: SaleDraftIssues = {};
  const money = parseAmountToMinorUnits(values.amount, currencyMinorUnitDigits);
  if ("error" in money) issues.amount = money.error;
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
