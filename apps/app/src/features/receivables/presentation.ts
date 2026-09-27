import { calendarLocalDateSchema } from "@pisto/contracts";

export function formatBusinessLocalDate(localDate: string, locale: string): string {
  const date = calendarLocalDateSchema.parse(localDate);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00.000Z`),
  );
}

export function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function amountInputPlaceholder(currencyMinorUnitDigits: number): string {
  return currencyMinorUnitDigits === 0 ? "0" : `0.${"0".repeat(currencyMinorUnitDigits)}`;
}
