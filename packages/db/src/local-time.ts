/// <reference types="temporal-spec/global" />
import { calendarLocalDateSchema } from "@pisto/contracts";

import { ProductError } from "./errors.ts";

const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));
const localFormatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const existing = localFormatters.get(timeZone);
  if (existing) return existing;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  localFormatters.set(timeZone, formatter);
  return formatter;
}

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    getFormatter(timeZone);
    return true;
  } catch (error) {
    // ICU reports an unknown IANA identifier as a RangeError.
    if (error instanceof RangeError) return false;
    throw error;
  }
}

/** ISO 4217 minor-unit exponent, or null for an unknown code or unsupported precision. */
export function getCurrencyMinorUnitDigits(currency: string): number | null {
  if (!supportedCurrencies.has(currency)) return null;
  const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits;
  return digits !== undefined && Number.isInteger(digits) && digits >= 0 && digits <= 4
    ? digits
    : null;
}

export function requireCalendarDate(value: string, message: string): void {
  if (!calendarLocalDateSchema.safeParse(value).success) {
    throw new ProductError("VALIDATION_ERROR", message);
  }
}

/** The following calendar day of an already validated local date. */
export function nextCalendarDate(localDate: string): string {
  if (localDate === "9999-12-31") {
    throw new ProductError("VALIDATION_ERROR", "The local date is invalid");
  }
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function resolveLocalDateTime(input: {
  date: string;
  time: string;
  timeZone: string;
}): Date {
  if (!isSupportedTimeZone(input.timeZone)) {
    throw new ProductError("VALIDATION_ERROR", "The business time zone is not supported");
  }
  const match = `${input.date}T${input.time}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) {
    throw new ProductError("VALIDATION_ERROR", "The sale date and time are invalid");
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  let plain: Temporal.PlainDateTime;
  try {
    plain = Temporal.PlainDateTime.from({ year, month, day, hour, minute }, { overflow: "reject" });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    throw new ProductError("VALIDATION_ERROR", "The sale date and time are invalid");
  }

  // A wall-clock minute maps to exactly one instant unless a daylight-saving
  // transition removes it (a gap) or repeats it (an overlap). Resolving the same
  // minute with both disambiguation policies detects either case in constant time:
  // the two results diverge only across a transition, and the requested local time
  // survives the round trip only when it genuinely exists twice.
  const earliest = plain.toZonedDateTime(input.timeZone, { disambiguation: "earlier" });
  const latest = plain.toZonedDateTime(input.timeZone, { disambiguation: "later" });
  if (earliest.epochMilliseconds !== latest.epochMilliseconds) {
    throw new ProductError(
      "VALIDATION_ERROR",
      latest.toPlainDateTime().equals(plain)
        ? "That local time is ambiguous in the business time zone"
        : "That local time does not exist in the business time zone",
    );
  }
  return new Date(earliest.epochMilliseconds);
}
