export const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type Weekday = (typeof weekdays)[number];

/** A date as the model heard it; the server turns it into a calendar date. */
export interface DateExpression {
  offsetDays: number | null;
  weekday: Weekday | null;
  day: number | null;
  month: number | null;
  year: number | null;
}

/** How far from the business-local today a spoken date may resolve. */
export const dateWindowDays = 60;
const dayMs = 86_400_000;

function toEpochDay(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`) / dayMs;
}

function fromEpochDay(epochDay: number): string {
  return new Date(epochDay * dayMs).toISOString().slice(0, 10);
}

function calendarDate(year: number, month: number, day: number): number | null {
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month - 1 ||
    value.getUTCDate() !== day
  ) {
    return null;
  }
  return value.getTime() / dayMs;
}

function explicitDate(
  expression: DateExpression & { day: number },
  today: number,
  direction: "past" | "future",
): number | null {
  const now = new Date(today * dayMs);
  const thisYear = now.getUTCFullYear();
  const thisMonth = now.getUTCMonth() + 1;
  const month = expression.month ?? thisMonth;
  const year = expression.year ?? thisYear;
  let candidate = calendarDate(year, month, expression.day);
  if (candidate === null) return null;
  const wrongSide = (value: number) => (direction === "past" ? value > today : value < today);
  // "el 28" said on the 2nd means last month's 28th for a sale and next month's for a due date.
  if (wrongSide(candidate) && expression.month === null) {
    const shift = direction === "past" ? -1 : 1;
    const shifted = new Date(Date.UTC(year, month - 1 + shift, 1));
    candidate = calendarDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, expression.day);
  } else if (wrongSide(candidate) && expression.year === null) {
    candidate = calendarDate(year + (direction === "past" ? -1 : 1), month, expression.day);
  }
  return candidate;
}

export type ResolvedDate =
  | { kind: "absent" }
  | { kind: "resolved"; date: string }
  | { kind: "invalid" };

/**
 * Resolves a heard date against the business-local `today`. A sale or payment date may only be in
 * the past; a due date only in the future; both within `dateWindowDays`.
 */
export function resolveDate(
  expression: DateExpression | null,
  today: string,
  direction: "past" | "future",
): ResolvedDate {
  if (
    expression === null ||
    (expression.offsetDays === null && expression.weekday === null && expression.day === null)
  ) {
    return { kind: "absent" };
  }
  const todayDay = toEpochDay(today);
  let resolved: number | null;
  if (expression.offsetDays !== null) {
    resolved = todayDay + expression.offsetDays;
  } else if (expression.day !== null) {
    resolved = explicitDate({ ...expression, day: expression.day }, todayDay, direction);
  } else {
    const target = weekdays.indexOf(expression.weekday as Weekday);
    const current = new Date(todayDay * dayMs).getUTCDay();
    resolved =
      direction === "past"
        ? todayDay - ((current - target + 7) % 7)
        : todayDay + (((target - current + 6) % 7) + 1);
  }
  if (resolved === null) return { kind: "invalid" };
  const distance = resolved - todayDay;
  const allowed =
    direction === "past"
      ? distance <= 0 && distance >= -dateWindowDays
      : distance >= 0 && distance <= dateWindowDays;
  return allowed ? { kind: "resolved", date: fromEpochDay(resolved) } : { kind: "invalid" };
}
