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
export const localTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const timestampSchema = z.string().datetime({ offset: true });
export const uuidSchema = z.string().uuid();
/** Server-issued base64url page cursor; clients pass it back unchanged. */
export const opaqueCursorSchema = z
  .string()
  .min(1)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);
export const boundedListLimitSchema = z.coerce.number().int().min(1).max(50).default(25);

export const calendarLocalDateSchema = z.iso
  .date({ error: "Must be a real calendar date" })
  .refine((value) => !value.startsWith("0000"), "Year zero is not supported");

export const shortRequestTextSchema = z.string().trim().min(1).max(240);

/** How a record was captured: a form, a dictated transcript or a typed natural-language message. */
export const entrySourceSchema = z.enum(["manual", "voice", "text"]);
