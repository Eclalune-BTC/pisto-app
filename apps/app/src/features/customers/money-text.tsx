import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

import { isPositiveAmount, useRecordFormat } from "./format";

type MoneyTextProps = {
  currency: string;
  digits: number;
  minorUnits: string;
  /** Renders the amount as an outflow, such as a reversal that undoes a payment. */
  negative?: boolean;
  /** Overdue money: destructive only when above zero. */
  overdue?: boolean;
  /** De-emphasizes an amount that no longer counts, such as a reversed payment. */
  muted?: boolean;
};

/** A table figure. Zero recedes, overdue money above zero is destructive, outflows carry a sign. */
export function MoneyText({
  currency,
  digits,
  minorUnits,
  muted = false,
  negative = false,
  overdue = false,
}: MoneyTextProps) {
  const format = useRecordFormat();
  const positive = isPositiveAmount(minorUnits);
  return (
    <Text
      className={cn(
        "font-ui text-[13px] tabular-nums",
        (muted || !positive) && "text-muted-foreground",
        overdue && positive && !muted && "text-destructive",
      )}
      numberOfLines={1}
    >
      {format.money(negative && positive ? `-${minorUnits}` : minorUnits, currency, digits)}
    </Text>
  );
}
