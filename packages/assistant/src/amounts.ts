const maxMinorUnits = 9_223_372_036_854_775_807n;
const decimalPattern = /^(\d{1,15})(?:\.(\d{1,6}))?$/;

/**
 * Converts a model-extracted decimal such as "5", "5.5" or "64.00" to integer minor units with the
 * given number of fraction digits. Anything else, including a value that would need rounding, is
 * null: the user states the amount again instead of the server guessing it.
 */
export function decimalToMinorUnits(value: string | null, digits: number): bigint | null {
  if (value === null) return null;
  const match = decimalPattern.exec(value.trim());
  if (!match) return null;
  const whole = match[1] as string;
  const fraction = match[2] ?? "";
  if (fraction.length > digits && /[1-9]/.test(fraction.slice(digits))) return null;
  const scaled = BigInt(whole + fraction.slice(0, digits).padEnd(digits, "0"));
  return scaled > maxMinorUnits ? null : scaled;
}

/** Positive minor units, or null for zero, a negative or an unreadable value. */
export function positiveMinorUnits(value: string | null, digits: number): bigint | null {
  const amount = decimalToMinorUnits(value, digits);
  return amount !== null && amount > 0n ? amount : null;
}

/**
 * Line subtotal of a scaled quantity at a unit price, rounded half up to the currency unit. This
 * is a preview; the record's own command recomputes every amount.
 */
export function lineSubtotal(
  quantityMinorUnits: bigint,
  quantityPrecision: number,
  unitAmountMinorUnits: bigint,
): bigint {
  const scale = 10n ** BigInt(quantityPrecision);
  const product = quantityMinorUnits * unitAmountMinorUnits;
  return (product + scale / 2n) / scale;
}
