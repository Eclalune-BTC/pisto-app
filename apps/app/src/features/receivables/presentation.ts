export function formatBusinessLocalDate(localDate: string, locale: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day) return localDate;
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

export function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function amountInputPlaceholder(currencyMinorUnitDigits: number): string {
  return currencyMinorUnitDigits === 0 ? "0" : `0.${"0".repeat(currencyMinorUnitDigits)}`;
}
