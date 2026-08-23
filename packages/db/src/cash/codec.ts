import {
  type CashAccountCommandResult,
  type CashMovementCommandResult,
  type CashTransferCommandResult,
  type CreateCashAccountRequest,
  cashAccountCommandResultSchema,
  cashMovementCommandResultSchema,
  cashTransferCommandResultSchema,
  createCashAccountRequestSchema,
  type ExpenseCommandResult,
  expenseCommandResultSchema,
  type UpdateCashAccountRequest,
  updateCashAccountRequestSchema,
} from "@pisto/contracts";

import { ProductError } from "../product.ts";
import type { CashCursorPayload, CashOperationAction } from "./types.ts";

const maximumMinorUnits = 9_223_372_036_854_775_807n;

export function parseCashMinorUnits(value: string): bigint {
  if (!/^[1-9]\d{0,18}$/.test(value)) {
    throw new ProductError("VALIDATION_ERROR", "Amount must be a positive integer in minor units");
  }
  const parsed = BigInt(value);
  if (parsed > maximumMinorUnits) {
    throw new ProductError("VALIDATION_ERROR", "Amount is too large");
  }
  return parsed;
}

export async function fingerprintCashCommand(
  action: CashOperationAction,
  payload: object,
): Promise<string> {
  const canonical = JSON.stringify({ version: 1, action, payload });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isCashResourceId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function encodeCashCursor(payload: CashCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeCashCursor(cursor: string): CashCursorPayload {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("createdAt" in parsed) ||
      !("id" in parsed) ||
      typeof parsed.createdAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.createdAt)) ||
      !isCashResourceId(parsed.id)
    ) {
      throw new Error("invalid cursor payload");
    }
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new ProductError("VALIDATION_ERROR", "The pagination cursor is invalid");
  }
}

export function nextCalendarDate(localDate: string): string {
  const match = localDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new ProductError("VALIDATION_ERROR", "The local date is invalid");
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
    throw new ProductError("VALIDATION_ERROR", "The local date is invalid");
  }
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function parseCreateAccount(command: CreateCashAccountRequest) {
  const parsed = createCashAccountRequestSchema.safeParse(command);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Cash account is invalid");
  return parsed.data;
}

export function parseUpdateAccount(command: UpdateCashAccountRequest) {
  const parsed = updateCashAccountRequestSchema.safeParse(command);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Cash account update is invalid");
  return parsed.data;
}

export function replayAccountResult(value: unknown): CashAccountCommandResult {
  const parsed = cashAccountCommandResultSchema.safeParse(value);
  if (!parsed.success) throw new Error("Stored cash account operation result is invalid");
  return { ...parsed.data, replayed: true };
}

export function replayExpenseResult(value: unknown): ExpenseCommandResult {
  const parsed = expenseCommandResultSchema.safeParse(value);
  if (!parsed.success) throw new Error("Stored expense operation result is invalid");
  return { ...parsed.data, replayed: true };
}

export function replayMovementResult(value: unknown): CashMovementCommandResult {
  const parsed = cashMovementCommandResultSchema.safeParse(value);
  if (!parsed.success) throw new Error("Stored cash movement operation result is invalid");
  return { ...parsed.data, replayed: true };
}

export function replayTransferResult(value: unknown): CashTransferCommandResult {
  const parsed = cashTransferCommandResultSchema.safeParse(value);
  if (!parsed.success) throw new Error("Stored cash transfer operation result is invalid");
  return { ...parsed.data, replayed: true };
}
