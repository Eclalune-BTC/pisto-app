import type { BusinessAccess, BusinessPermission } from "@pisto/contracts";

import { resolveBusinessAccess } from "./product-access.ts";

const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));
const localFormatters = new Map<string, Intl.DateTimeFormat>();

export type ProductErrorCode =
  | "BUSINESS_REQUIRED"
  | "CONFLICT"
  | "FORBIDDEN"
  | "IDEMPOTENCY_CONFLICT"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR";

export class ProductError extends Error {
  override readonly name = "ProductError";

  constructor(
    readonly code: ProductErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface ProductActor {
  userId: string;
  sessionId: string;
  activeBusinessId: string | null;
}

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

function localParts(instant: Date, timeZone: string) {
  const values = Object.fromEntries(
    getFormatter(timeZone)
      .formatToParts(instant)
      .filter(({ type }) => ["year", "month", "day", "hour", "minute"].includes(type))
      .map(({ type, value }) => [type, value]),
  );
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    time: `${values.hour}:${values.minute}`,
  };
}

export function isSupportedCurrency(currency: string): boolean {
  return getCurrencyMinorUnitDigits(currency) !== null;
}

export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    getFormatter(timeZone);
    return true;
  } catch {
    return false;
  }
}

export function getCurrencyMinorUnitDigits(currency: string): number | null {
  if (!supportedCurrencies.has(currency)) return null;
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits;
    return typeof digits === "number" && Number.isInteger(digits) && digits >= 0 && digits <= 4
      ? digits
      : null;
  } catch {
    return null;
  }
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
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const parts = [yearText, monthText, dayText, hourText, minuteText].map(Number);
  const [year, month, day, hour, minute] = parts;
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    throw new ProductError("VALIDATION_ERROR", "The sale date and time are invalid");
  }
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const canonical = new Date(naiveUtc);
  if (
    canonical.getUTCFullYear() !== year ||
    canonical.getUTCMonth() !== month - 1 ||
    canonical.getUTCDate() !== day ||
    canonical.getUTCHours() !== hour ||
    canonical.getUTCMinutes() !== minute
  ) {
    throw new ProductError("VALIDATION_ERROR", "The sale date and time are invalid");
  }

  const matches: Date[] = [];
  const searchStart = naiveUtc - 14 * 60 * 60_000;
  const searchEnd = naiveUtc + 14 * 60 * 60_000;
  for (let timestamp = searchStart; timestamp <= searchEnd; timestamp += 60_000) {
    const candidate = new Date(timestamp);
    const candidateParts = localParts(candidate, input.timeZone);
    if (candidateParts.date === input.date && candidateParts.time === input.time) {
      matches.push(candidate);
      if (matches.length > 1) break;
    }
  }
  if (matches.length !== 1) {
    throw new ProductError(
      "VALIDATION_ERROR",
      matches.length === 0
        ? "That local time does not exist in the business time zone"
        : "That local time is ambiguous in the business time zone",
    );
  }
  return matches[0] as Date;
}

export async function fingerprintValue(value: unknown): Promise<string> {
  const canonical = JSON.stringify(value);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function requireActiveBusiness(actor: ProductActor): string {
  if (!actor.activeBusinessId) {
    throw new ProductError("BUSINESS_REQUIRED", "Select or create a business before continuing");
  }
  return actor.activeBusinessId;
}

export function requireBusinessPermission(
  role: string,
  permission: BusinessPermission,
): BusinessAccess {
  const access = resolveBusinessAccess(role);
  if (!access?.permissions.includes(permission)) {
    throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
  }
  return access;
}
