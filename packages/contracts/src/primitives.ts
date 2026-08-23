import { z } from "zod";

const signedBigintMaximum = 9_223_372_036_854_775_807n;

function isNonNegativeSignedBigint(value: string): boolean {
  return /^(?:0|[1-9]\d{0,18})$/.test(value) && BigInt(value) <= signedBigintMaximum;
}

function isCanonicalSignedBigint(value: string): boolean {
  if (!/^(?:0|[1-9]\d{0,18}|-[1-9]\d{0,18})$/.test(value)) return false;
  const parsed = BigInt(value);
  return parsed >= -signedBigintMaximum && parsed <= signedBigintMaximum;
}

export const aggregateIntegerSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)$/, "Must be a canonical non-negative integer");

export const signedAggregateIntegerSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*|-[1-9]\d*)$/, "Must be a canonical signed integer");

export const minorUnitsSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d{0,18})$/, "Must be a canonical non-negative integer")
  .refine(isNonNegativeSignedBigint, "Must fit in a signed 64-bit integer");

export const positiveMinorUnitsSchema = minorUnitsSchema.refine(
  (value) => isNonNegativeSignedBigint(value) && BigInt(value) > 0n,
  "Must be greater than zero",
);

export const signedMinorUnitsSchema = z
  .string()
  .refine(isCanonicalSignedBigint, "Must be a canonical signed 64-bit integer");

export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);
export const currencyMinorUnitDigitsSchema = z.number().int().min(0).max(4);
export const timeZoneSchema = z.string().trim().min(1).max(64);
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const timestampSchema = z.string().datetime({ offset: true });
export const uuidSchema = z.string().uuid();
export const opaqueCursorSchema = z.string().min(1).max(512);
export const boundedListLimitSchema = z.coerce.number().int().min(1).max(50).default(25);

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function lastDayOfMonth(year: number, month: number): number {
  if (month === 2) return isGregorianLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isCalendarLocalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= lastDayOfMonth(year, month);
}

/**
 * A `YYYY-MM-DD` date that also exists in the proleptic Gregorian calendar, so `2026-02-30` and
 * `2025-02-29` are rejected. Use it for a business-local date a user supplies; `localDateSchema`
 * stays format-only for values already produced by a trusted calendar computation.
 */
export const calendarLocalDateSchema = localDateSchema.refine(
  isCalendarLocalDate,
  "Must be a real calendar date",
);
