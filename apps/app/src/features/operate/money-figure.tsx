import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { formatMinorUnits, toDecimalString } from "@/lib/money";

/**
 * The formatted amount split before its decimal separator, so the cents can be set smaller. The
 * split comes from Intl's own parts of the same exact decimal, never from string positions.
 */
export function splitMoney(
  minorUnits: string,
  currency: string,
  fractionDigits: number,
  locale: string,
): { whole: string; fraction: string } {
  const formatted = formatMinorUnits(minorUnits, currency, fractionDigits, locale);
  if (fractionDigits === 0) return { whole: formatted, fraction: "" };
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).formatToParts(toDecimalString(minorUnits, fractionDigits) as Intl.StringNumericLiteral);
  const decimalIndex = parts.findIndex((part) => part.type === "decimal");
  const fraction = parts
    .slice(decimalIndex)
    .map((part) => part.value)
    .join("");
  if (decimalIndex < 0 || !formatted.endsWith(fraction)) return { whole: formatted, fraction: "" };
  return { whole: formatted.slice(0, -fraction.length), fraction };
}

export function MoneyFigure({
  className,
  currency,
  fractionDigits,
  fractionClassName,
  locale,
  minorUnits,
}: {
  className?: string;
  currency: string;
  fractionDigits: number;
  fractionClassName?: string;
  locale: string;
  minorUnits: string;
}) {
  const { whole, fraction } = splitMoney(minorUnits, currency, fractionDigits, locale);
  return (
    <Text
      accessibilityLabel={formatMinorUnits(minorUnits, currency, fractionDigits, locale)}
      className={cn("font-heading tabular-nums", className)}
      numberOfLines={1}
    >
      {whole}
      {fraction ? (
        <Text className={cn("font-heading tabular-nums", fractionClassName)}>{fraction}</Text>
      ) : null}
    </Text>
  );
}
