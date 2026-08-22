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

export function formatMonthYear(value: Date | string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(value),
  );
}
