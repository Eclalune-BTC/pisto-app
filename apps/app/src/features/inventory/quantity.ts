const maximumMinorQuantity = 9_223_372_036_854_775_807n;

export type QuantityParseError =
  | "invalid-decimals"
  | "invalid-integer"
  | "negative"
  | "non-positive"
  | "too-large";

export function parseQuantityToMinorUnits(
  input: string,
  precision: number,
  options: { allowZero?: boolean } = {},
): { value: string } | { error: QuantityParseError } {
  if (!Number.isInteger(precision) || precision < 0 || precision > 3) {
    return { error: "invalid-decimals" };
  }
  const normalized = input.trim();
  if (normalized.startsWith("-")) return { error: "negative" };
  if (!/^\d+(?:[.,]\d+)?$/.test(normalized)) return { error: "invalid-integer" };
  const [whole = "", fraction = ""] = normalized.replace(",", ".").split(".");
  if (fraction.length > precision) return { error: "invalid-decimals" };
  const canonicalWhole = whole.replace(/^0+(?=\d)/, "");
  const minorText = `${canonicalWhole}${fraction.padEnd(precision, "0")}`.replace(/^0+(?=\d)/, "");
  const parsed = BigInt(minorText || "0");
  if (parsed > maximumMinorQuantity) return { error: "too-large" };
  if (!options.allowZero && parsed === 0n) return { error: "non-positive" };
  return { value: parsed.toString() };
}

export function formatQuantityMinorUnits(value: string, precision: number): string {
  if (
    !/^(?:0|[1-9]\d*)$/.test(value) ||
    !Number.isInteger(precision) ||
    precision < 0 ||
    precision > 3
  ) {
    throw new Error("Quantity value or precision is invalid");
  }
  if (precision === 0) return value;
  const padded = value.padStart(precision + 1, "0");
  return `${padded.slice(0, -precision)}.${padded.slice(-precision)}`;
}
