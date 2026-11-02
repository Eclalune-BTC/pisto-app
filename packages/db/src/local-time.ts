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

/** The following calendar day of an already validated local date. */
export function nextCalendarDate(localDate: string): string {
  if (localDate === "9999-12-31") {
    throw new ProductError("VALIDATION_ERROR", "The local date is invalid");
  }
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

const minuteMs = 60_000;
const dayMs = 86_400_000;

/** The zone's UTC offset at an instant, at the minute precision of the shared formatter. */
function zoneOffsetMs(epochMs: number, timeZone: string): number {
  const parts = getFormatter(timeZone).formatToParts(new Date(epochMs));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((entry) => entry.type === type)?.value);
  const wall = new Date(0);
  wall.setUTCFullYear(part("year"), part("month") - 1, part("day"));
  wall.setUTCHours(part("hour"), part("minute"), 0, 0);
  return wall.getTime() - Math.floor(epochMs / minuteMs) * minuteMs;
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
  // The wall-clock fields read as if they were UTC; a calendar overflow (Feb 30) is rejected.
  const wall = new Date(0);
  wall.setUTCFullYear(year, month - 1, day);
  wall.setUTCHours(hour, minute, 0, 0);
  if (
    wall.getUTCFullYear() !== year ||
    wall.getUTCMonth() !== month - 1 ||
    wall.getUTCDate() !== day ||
    wall.getUTCHours() !== hour ||
    wall.getUTCMinutes() !== minute
  ) {
    throw new ProductError("VALIDATION_ERROR", "The sale date and time are invalid");
  }

  // A wall-clock minute maps to exactly one instant unless a daylight-saving transition removes
  // it (a gap) or repeats it (an overlap). The offsets a day before and after bracket any
  // transition near this minute; each offset whose instant reads back as the same wall time is a
  // real occurrence. None means a gap and two mean an overlap.
  const local = wall.getTime();
  const occurrences = new Set<number>();
  for (const offset of [
    zoneOffsetMs(local - dayMs, input.timeZone),
    zoneOffsetMs(local + dayMs, input.timeZone),
  ]) {
    const instant = local - offset;
    if (zoneOffsetMs(instant, input.timeZone) === offset) occurrences.add(instant);
  }
  const [instant, repeated] = occurrences;
  if (instant === undefined || repeated !== undefined) {
    throw new ProductError(
      "VALIDATION_ERROR",
      repeated !== undefined
        ? "That local time is ambiguous in the business time zone"
        : "That local time does not exist in the business time zone",
    );
  }
  return new Date(instant);
}
