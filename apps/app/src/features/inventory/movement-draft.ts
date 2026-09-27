import {
  calendarLocalDateSchema,
  localTimeSchema,
  type RecordInventoryMovementRequest,
  recordInventoryMovementRequestSchema,
} from "@pisto/contracts";

import type { InventoryMovementDraft, InventoryMovementErrors } from "./movement-editor";
import { parseQuantityToMinorUnits } from "./quantity";

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
