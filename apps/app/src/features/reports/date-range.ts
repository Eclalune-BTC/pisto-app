import type { OperatingReportQuery } from "@pisto/contracts";
import { calendarLocalDateSchema, operatingReportQuerySchema } from "@pisto/contracts";

import { currentLocalDateTime } from "@/lib/money";
import { firstParam, type RouteParam } from "../cash/search-params";

export type ReportRangeIssue = "invalid-end" | "invalid-start" | "reversed" | "too-long";

export type ReportRangeValidation =
  | { issue: ReportRangeIssue; valid: false }
  | { valid: true; value: OperatingReportQuery };

export const reportRangePresets = ["thisMonth", "lastMonth", "last30Days"] as const;

export type ReportRangePreset = (typeof reportRangePresets)[number];

export type ReportPresetRanges = Record<ReportRangePreset, OperatingReportQuery>;

export type ReportRangeSearchParams = { end?: RouteParam; start?: RouteParam };

const millisecondsPerDay = 86_400_000;

/** Moves a `YYYY-MM-DD` calendar date by whole days without passing through a device time zone. */
function shiftLocalDate(localDate: string, days: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00.000Z`) + days * millisecondsPerDay)
    .toISOString()
    .slice(0, 10);
}

/** The inclusive range a preset names, counted from the business-local date `today`. */
export function presetRange(preset: ReportRangePreset, today: string): OperatingReportQuery {
  const monthStart = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "thisMonth":
      return { startLocalDate: monthStart, endLocalDate: today };
    case "lastMonth": {
      const previousMonthEnd = shiftLocalDate(monthStart, -1);
      return {
        startLocalDate: `${previousMonthEnd.slice(0, 8)}01`,
        endLocalDate: previousMonthEnd,
      };
    }
    case "last30Days":
      return { startLocalDate: shiftLocalDate(today, -29), endLocalDate: today };
  }
}

/** Every preset for today in the business time zone, which can differ from the device's. */
export function businessPresetRanges(timeZone: string): ReportPresetRanges {
  const today = currentLocalDateTime(timeZone).date;
  return {
    thisMonth: presetRange("thisMonth", today),
    lastMonth: presetRange("lastMonth", today),
    last30Days: presetRange("last30Days", today),
  };
}

export function currentBusinessMonthRange(timeZone: string): OperatingReportQuery {
  return presetRange("thisMonth", currentLocalDateTime(timeZone).date);
}

export function sameRange(left: OperatingReportQuery, right: OperatingReportQuery): boolean {
  return left.startLocalDate === right.startLocalDate && left.endLocalDate === right.endLocalDate;
}

export function matchingPreset(
  range: OperatingReportQuery,
  presets: ReportPresetRanges,
): ReportRangePreset | "custom" {
  return reportRangePresets.find((preset) => sameRange(presets[preset], range)) ?? "custom";
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

/**
 * The applied range lives in the URL so the browser history and a shared link keep it. A range the
 * contract rejects is ignored rather than corrected, and the screen falls back to its default.
 */
export function parseReportRangeParams(
  params: ReportRangeSearchParams,
): OperatingReportQuery | undefined {
  const startLocalDate = firstParam(params.start);
  const endLocalDate = firstParam(params.end);
  if (startLocalDate === undefined || endLocalDate === undefined) return undefined;
  const validation = validateReportRange({ endLocalDate, startLocalDate });
  return validation.valid ? validation.value : undefined;
}

/** The default range keeps a clean URL. */
export function reportRangeParams(
  range: OperatingReportQuery,
  defaultRange: OperatingReportQuery,
): { end: string | undefined; start: string | undefined } {
  return sameRange(range, defaultRange)
    ? { end: undefined, start: undefined }
    : { end: range.endLocalDate, start: range.startLocalDate };
}
