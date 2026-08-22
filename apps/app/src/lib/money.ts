const maximumMinorUnits = 9_223_372_036_854_775_807n;

export type AmountParseError =
  | "invalid-decimals"
  | "invalid-integer"
  | "non-positive"
  | "too-large";

export function parseAmountToMinorUnits(
  input: string,
  fractionDigits: number,
): { value: string } | { error: AmountParseError } {
  const normalized = input.trim().replace(",", ".");
  const pattern =
    fractionDigits === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:\\.\\d{0,${fractionDigits}})?$`);
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

export function formatMinorUnits(
  minorUnits: string,
  currency: string,
  fractionDigits: number,
  locale: string,
): string {
  const padded = minorUnits.padStart(fractionDigits + 1, "0");
  const wholeText = fractionDigits === 0 ? padded : padded.slice(0, -fractionDigits);
  const fractionText = fractionDigits === 0 ? "" : padded.slice(-fractionDigits);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
  return formatter
    .formatToParts(BigInt(wholeText))
    .map((part) => (part.type === "fraction" ? fractionText : part.value))
    .join("");
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
