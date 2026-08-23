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

import { fingerprintCommand, maximumMinorUnits, parseReplaySnapshot } from "../operation-log.ts";
import { ProductError } from "../product.ts";
import type { CashCursorPayload, CashOperationAction } from "./types.ts";

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

export function fingerprintCashCommand(
  action: CashOperationAction,
  payload: object,
): Promise<string> {
  return fingerprintCommand(action, payload);
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
  return {
    ...parseReplaySnapshot(
      cashAccountCommandResultSchema,
      value,
      "Stored cash account operation result is invalid",
    ),
    replayed: true,
  };
}

export function replayExpenseResult(value: unknown): ExpenseCommandResult {
  return {
    ...parseReplaySnapshot(
      expenseCommandResultSchema,
      value,
      "Stored expense operation result is invalid",
    ),
    replayed: true,
  };
}

export function replayMovementResult(value: unknown): CashMovementCommandResult {
  return {
    ...parseReplaySnapshot(
      cashMovementCommandResultSchema,
      value,
      "Stored cash movement operation result is invalid",
    ),
    replayed: true,
  };
}

export function replayTransferResult(value: unknown): CashTransferCommandResult {
  return {
    ...parseReplaySnapshot(
      cashTransferCommandResultSchema,
      value,
      "Stored cash transfer operation result is invalid",
    ),
    replayed: true,
  };
}
