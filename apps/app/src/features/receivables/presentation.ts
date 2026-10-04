export function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function amountInputPlaceholder(currencyMinorUnitDigits: number): string {
  return currencyMinorUnitDigits === 0 ? "0" : `0.${"0".repeat(currencyMinorUnitDigits)}`;
}
