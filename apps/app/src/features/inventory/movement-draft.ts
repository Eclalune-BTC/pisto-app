import {
  type RecordInventoryMovementRequest,
  recordInventoryMovementRequestSchema,
} from "@pisto/contracts";

import type { InventoryMovementDraft, InventoryMovementErrors } from "./movement-editor";
import { parseQuantityToMinorUnits } from "./quantity";

export function isValidCalendarDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isValidLocalTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function buildMovementCommand(input: {
  draft: InventoryMovementDraft;
  idempotencyKey: string;
  quantityPrecision: number;
}): { errors: InventoryMovementErrors } | { command: RecordInventoryMovementRequest } {
  const errors: InventoryMovementErrors = {};
  const quantity = parseQuantityToMinorUnits(input.draft.quantity, input.quantityPrecision);
  const reason = input.draft.reason.trim();
  if ("error" in quantity) errors.quantity = quantity.error;
  if (!reason || reason.length > 240) errors.reason = "invalid";
  if (!isValidCalendarDate(input.draft.occurredLocalDate)) {
    errors.occurredLocalDate = "invalid";
  }
  if (!isValidLocalTime(input.draft.occurredLocalTime)) {
    errors.occurredLocalTime = "invalid";
  }
  if (Object.keys(errors).length > 0 || "error" in quantity) return { errors };
  const parsed = recordInventoryMovementRequestSchema.safeParse({
    idempotencyKey: input.idempotencyKey,
    action: input.draft.action,
    quantityMinorUnits: quantity.value,
    reason,
    occurredLocalDate: input.draft.occurredLocalDate,
    occurredLocalTime: input.draft.occurredLocalTime,
  });
  if (!parsed.success) return { errors: { reason: "invalid" } };
  return { command: parsed.data };
}
