import { ProductError } from "../errors.ts";

const signedBigintMaximum = 9_223_372_036_854_775_807n;

function requireStorable(value: bigint, label: string): bigint {
  if (value > signedBigintMaximum) {
    throw new ProductError("VALIDATION_ERROR", `${label} exceeds the supported range`);
  }
  return value;
}

/**
 * Quantity times unit price in exact integers. The quantity is scaled by 10^precision, so the
 * product is divided back and rounded half up to a whole minor unit.
 */
export function lineSubtotalMinorUnits(
  quantityMinorUnits: bigint,
  unitPriceMinorUnits: bigint,
  quantityPrecision: number,
): bigint {
  if (quantityMinorUnits <= 0n || unitPriceMinorUnits < 0n) {
    throw new ProductError("VALIDATION_ERROR", "Sale line amounts must not be negative");
  }
  if (!Number.isInteger(quantityPrecision) || quantityPrecision < 0 || quantityPrecision > 3) {
    throw new Error("Quantity precision must be an integer from 0 to 3");
  }
  const scale = 10n ** BigInt(quantityPrecision);
  const subtotal = (2n * quantityMinorUnits * unitPriceMinorUnits + scale) / (2n * scale);
  return requireStorable(subtotal, "A sale line total");
}

export function saleTotalMinorUnits(subtotals: readonly bigint[]): bigint {
  return requireStorable(
    subtotals.reduce((total, subtotal) => total + subtotal, 0n),
    "The sale total",
  );
}
