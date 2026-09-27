import { calendarLocalDateSchema } from "@pisto/contracts";

export function formatLocalizedDateTime(
  value: Date | string,
  locale: string,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

export function formatLocalizedDate(value: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "short" }).format(new Date(value));
}

export function formatMonthYear(localDate: string, locale: string): string {
  const date = calendarLocalDateSchema.parse(localDate);
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
