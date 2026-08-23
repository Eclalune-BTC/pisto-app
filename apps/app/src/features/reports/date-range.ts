import type { OperatingReportQuery } from "@pisto/contracts";
import { calendarLocalDateSchema, operatingReportQuerySchema } from "@pisto/contracts";

import { currentLocalDateTime } from "@/lib/money";

export type ReportRangeIssue = "invalid-end" | "invalid-start" | "reversed" | "too-long";

export type ReportRangeValidation =
  | { issue: ReportRangeIssue; valid: false }
  | { valid: true; value: OperatingReportQuery };

export function currentBusinessMonthRange(timeZone: string): OperatingReportQuery {
  const { date } = currentLocalDateTime(timeZone);
  return { startLocalDate: `${date.slice(0, 8)}01`, endLocalDate: date };
}

/**
 * Classifies why the contract rejected a typed range so the screen can name the
 * field at fault. The contract stays the only authority on whether the range is
 * acceptable; this never widens it.
 */
export function validateReportRange(input: {
  endLocalDate: string;
  startLocalDate: string;
}): ReportRangeValidation {
  if (!calendarLocalDateSchema.safeParse(input.startLocalDate).success) {
    return { issue: "invalid-start", valid: false };
  }
  if (!calendarLocalDateSchema.safeParse(input.endLocalDate).success) {
    return { issue: "invalid-end", valid: false };
  }
  const parsed = operatingReportQuerySchema.safeParse(input);
  if (parsed.success) return { valid: true, value: parsed.data };
  // Both values are already real calendar dates in `YYYY-MM-DD`, where text
  // order is calendar order.
  return {
    issue: input.endLocalDate < input.startLocalDate ? "reversed" : "too-long",
    valid: false,
  };
}
