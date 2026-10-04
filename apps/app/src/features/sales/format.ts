export function formatSaleCount(value: string, locale: string): string {
  // A canonical integer string formats exactly; a number would round above 2^53.
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value as Intl.StringNumericLiteral,
  );
}
