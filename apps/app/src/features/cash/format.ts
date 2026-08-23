import { formatMinorUnits } from "@/lib/money";

export function formatCashMinorUnits(
  minorUnits: string,
  currency: string,
  fractionDigits: number,
  locale: string,
): string {
  const negative = minorUnits.startsWith("-");
  const magnitude = negative ? minorUnits.slice(1) : minorUnits;
  const formatted = formatMinorUnits(magnitude, currency, fractionDigits, locale);
  return negative ? `-${formatted}` : formatted;
}
