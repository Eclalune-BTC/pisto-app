const maximumMinorUnits = 9_223_372_036_854_775_807n;

// Intl renders through a double, so a minor-unit magnitude above 2^52 can no
// longer round-trip exactly. That is about 45 trillion at two digits. Refusing
// to render past it is the only honest option: the alternative is a money
// figure that is quietly wrong in its low digits.
const maximumDisplayMinorUnits = 2n ** 52n;

const canonicalMinorUnits = /^-?(?:0|[1-9]\d*)$/;

export type AmountParseError =
  | "invalid-decimals"
  | "invalid-integer"
  | "non-positive"
  | "too-large";

function assertFractionDigits(fractionDigits: number): void {
  if (!Number.isInteger(fractionDigits) || fractionDigits < 0 || fractionDigits > 4) {
    throw new RangeError(`Unsupported currency exponent: ${fractionDigits}`);
  }
}

export function parseAmountToMinorUnits(
  input: string,
  fractionDigits: number,
): { value: string } | { error: AmountParseError } {
  assertFractionDigits(fractionDigits);
  const trimmed = input.trim();

  // A comma followed by exactly three digits is a group separator to some
  // people and a decimal separator to others. "1,500" would mean 1500 or
  // 1.500 depending on the reader, and at a three-digit currency exponent
  // guessing wrong understates the amount by a thousand. Refuse instead.
  if (/,\d{3}(?!\d)/.test(trimmed)) {
    return { error: "invalid-decimals" };
  }
  if ((trimmed.match(/[.,]/g) ?? []).length > 1) {
    return { error: "invalid-decimals" };
  }

  const normalized = trimmed.replace(",", ".");
  const pattern =
    fractionDigits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{1,${fractionDigits}})?$`);
  if (!pattern.test(normalized)) {
    return {
      error: fractionDigits === 0 ? "invalid-integer" : "invalid-decimals",
    };
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  const canonical = `${whole}${fraction.padEnd(fractionDigits, "0")}`.replace(/^0+(?=\d)/, "");
  const value = BigInt(canonical || "0");
  if (value <= 0n) return { error: "non-positive" };
  if (value > maximumMinorUnits) return { error: "too-large" };
  return { value: value.toString() };
}

/**
 * Exact, sign-correct decimal text for a minor-unit amount. This is the part
 * that must never lose a digit, so it stays in BigInt and never touches a
 * double. Rendering that text for a locale is Intl's job, not ours.
 */
export function toDecimalString(minorUnits: string, fractionDigits: number): string {
  assertFractionDigits(fractionDigits);
  if (!canonicalMinorUnits.test(minorUnits) || minorUnits === "-0") {
    throw new TypeError(`Not a canonical minor-unit amount: ${JSON.stringify(minorUnits)}`);
  }
  const value = BigInt(minorUnits);
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(fractionDigits + 1, "0");
  const whole = fractionDigits === 0 ? digits : digits.slice(0, -fractionDigits);
  const fraction = fractionDigits === 0 ? "" : `.${digits.slice(-fractionDigits)}`;
  return `${negative ? "-" : ""}${whole}${fraction}`;
}

export function formatMinorUnits(
  minorUnits: string,
  currency: string,
  fractionDigits: number,
  locale: string,
): string {
  const decimal = toDecimalString(minorUnits, fractionDigits);
  const value = BigInt(minorUnits);
  const magnitude = value < 0n ? -value : value;
  if (magnitude > maximumDisplayMinorUnits) {
    throw new RangeError(`Amount is outside the exactly displayable range: ${minorUnits}`);
  }
  // Hand Intl a number and let it own every presentation decision: the digits
  // of the locale's numbering system, the position of the sign, and the
  // currency placement. Splicing formatted parts together breaks all three.
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(decimal));
}

export function currentLocalDateTime(timeZone: string): { date: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .filter(({ type }) => ["year", "month", "day", "hour", "minute"].includes(type))
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}
