import { receivablePaymentSchema, receivableSchema } from "@pisto/contracts";
import { type ZodType, z } from "zod";

import { ProductError } from "../product.ts";
import type { PageCursor } from "./types.ts";

const maximumMinorUnits = 9_223_372_036_854_775_807n;
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const paymentResultSchema = z.object({
  payment: receivablePaymentSchema,
  receivable: receivableSchema,
});

export function validate<T>(schema: ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", message);
  return parsed.data;
}

export function parsePositiveMinorUnits(value: string): bigint {
  if (!/^[1-9]\d{0,18}$/.test(value)) {
    throw new ProductError("VALIDATION_ERROR", "The amount must be a positive integer");
  }
  const parsed = BigInt(value);
  if (parsed > maximumMinorUnits) {
    throw new ProductError("VALIDATION_ERROR", "The amount is too large");
  }
  return parsed;
}

export function assertCalendarDate(value: string, field: string): void {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new ProductError("VALIDATION_ERROR", `${field} is invalid`);
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new ProductError("VALIDATION_ERROR", `${field} is invalid`);
  }
}

export async function sha256(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(value)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function commandFingerprint(action: string, payload: unknown): Promise<string> {
  return sha256({ action, payload, version: 1 });
}

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string, expectedFilterFingerprint: string): PageCursor {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== 1 ||
      !("createdAt" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      new Date(parsed.createdAt).toISOString() !== parsed.createdAt ||
      !("id" in parsed) ||
      typeof parsed.id !== "string" ||
      !uuidPattern.test(parsed.id) ||
      !("filterFingerprint" in parsed) ||
      parsed.filterFingerprint !== expectedFilterFingerprint
    ) {
      throw new Error("Invalid cursor");
    }
    return parsed as PageCursor;
  } catch {
    throw new ProductError("VALIDATION_ERROR", "The page cursor is invalid for this query");
  }
}
