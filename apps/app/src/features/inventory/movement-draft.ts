import {
  calendarLocalDateSchema,
  localTimeSchema,
  type RecordInventoryMovementRequest,
  recordInventoryMovementRequestSchema,
} from "@pisto/contracts";

import { parseQuantityToMinorUnits } from "./quantity";

export type InventoryDraftAction = RecordInventoryMovementRequest["action"];

export const inventoryDraftActions: readonly InventoryDraftAction[] = [
  "receive",
  "adjust_in",
  "adjust_out",
];

export interface InventoryMovementDraft {
  action: InventoryDraftAction;
  occurredLocalDate: string;
  occurredLocalTime: string;
  quantity: string;
  reason: string;
}

export type InventoryMovementField = Exclude<keyof InventoryMovementDraft, "action">;

export type InventoryMovementErrors = Partial<Record<InventoryMovementField, string>>;

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
  if (!calendarLocalDateSchema.safeParse(input.draft.occurredLocalDate).success) {
    errors.occurredLocalDate = "invalid";
  }
  if (!localTimeSchema.safeParse(input.draft.occurredLocalTime).success) {
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

/** The signed change a reviewed movement makes, as exact minor-unit text. */
export function movementDelta(command: RecordInventoryMovementRequest): string {
  return command.action === "adjust_out"
    ? `-${command.quantityMinorUnits}`
    : command.quantityMinorUnits;
}

/**
 * The balance the movement would leave, from the current server balance. It previews the review;
 * the server computes the committed balance under its own lock.
 */
export function balanceAfter(onHandMinorUnits: string, command: RecordInventoryMovementRequest) {
  return BigInt(onHandMinorUnits) + BigInt(movementDelta(command));
}
