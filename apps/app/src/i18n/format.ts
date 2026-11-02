import { calendarLocalDateSchema, localTimeSchema } from "@pisto/contracts";

// Forms take a 24-hour HH:MM time, so every displayed moment uses the same clock, and a spelled
// month cannot be read in the wrong day/month order.
const momentFormat = {
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
} as const satisfies Intl.DateTimeFormatOptions;

/** An exact instant, shown in the given time zone (the record's or the business's). */
export function formatLocalizedDateTime(
  value: Date | string,
  locale: string,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale, { ...momentFormat, timeZone }).format(new Date(value));
}

export function formatLocalizedDate(
  value: Date | string,
  locale: string,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone }).format(new Date(value));
}

/**
 * A business-local wall-clock moment such as a reviewed draft. It is read as UTC on purpose: the
 * values are already local, so no device or business offset may shift the minute that was typed.
 */
export function formatLocalMoment(localDate: string, localTime: string, locale: string): string {
  const date = calendarLocalDateSchema.parse(localDate);
  const time = localTimeSchema.parse(localTime);
  return formatLocalizedDateTime(`${date}T${time}:00.000Z`, locale, "UTC");
}

export function formatMonthYear(localDate: string, locale: string): string {
  const date = calendarLocalDateSchema.parse(localDate);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

/** Formats a business-local calendar date without shifting it through the device time zone. */
export function formatLocalDate(localDate: string, locale: string): string {
  const date = calendarLocalDateSchema.parse(localDate);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}

/** The name of a business-local date's month, "septiembre" or "sept", for charts and tables. */
export function formatMonthName(
  localDate: string,
  locale: string,
  month: "long" | "short",
): string {
  const date = calendarLocalDateSchema.parse(localDate);
  return new Intl.DateTimeFormat(locale, { month, timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}
