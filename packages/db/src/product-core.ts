/// <reference types="temporal-spec/global" />
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
  let plain: Temporal.PlainDateTime;
  try {
    plain = Temporal.PlainDateTime.from({ year, month, day, hour, minute }, { overflow: "reject" });
  } catch {
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

// PostgreSQL treats % and _ as wildcards inside LIKE/ILIKE, so an unescaped
// user search of "%" matches every row. Callers must pair this with `escape '\'`.
export function likePattern(search: string): string {
  return `%${search.replace(/[%_]/g, "$&")}%`;
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
