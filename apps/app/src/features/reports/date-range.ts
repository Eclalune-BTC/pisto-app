import type { OperatingReportQuery } from "@pisto/contracts";
import { calendarMonthSchema } from "@pisto/contracts";

import { currentLocalDateTime } from "@/lib/money";
import { firstParam, type RouteParam } from "@/lib/route-params";

export type ReportMonthSearchParams = { month?: RouteParam };

const millisecondsPerDay = 86_400_000;

/** Moves a `YYYY-MM-DD` calendar date by whole days without passing through a device time zone. */
function shiftLocalDate(localDate: string, days: number): string {
  return new Date(Date.parse(`${localDate}T00:00:00.000Z`) + days * millisecondsPerDay)
    .toISOString()
    .slice(0, 10);
}

/** Moves a "YYYY-MM" month by whole months. */
export function shiftMonth(month: string, months: number): string {
  const index = Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + months;
  const year = Math.floor(index / 12);
  return `${String(year).padStart(4, "0")}-${String(index - year * 12 + 1).padStart(2, "0")}`;
}

/** A month's report range; the month in progress ends today, since later days have no records. */
export function monthRange(month: string, today: string): OperatingReportQuery {
  const lastDay = shiftLocalDate(`${shiftMonth(month, 1)}-01`, -1);
  return {
    startLocalDate: `${month}-01`,
    endLocalDate: today.slice(0, 7) === month ? today : lastDay,
  };
}

/** The month to date in the business time zone, which can differ from the device's. */
export function currentBusinessMonthRange(timeZone: string): OperatingReportQuery {
  const today = currentLocalDateTime(timeZone).date;
  return monthRange(today.slice(0, 7), today);
}

/** The month in the URL, or the current one; a malformed or future month is not reported. */
export function parseMonthParam(value: RouteParam, currentMonth: string): string {
  const month = firstParam(value);
  return month && calendarMonthSchema.safeParse(month).success && month <= currentMonth
    ? month
    : currentMonth;
}
