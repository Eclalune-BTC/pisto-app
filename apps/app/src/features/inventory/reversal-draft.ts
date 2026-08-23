import type { ReverseInventoryMovementRequest } from "../../../../../packages/contracts/src/catalog";
import { reverseInventoryMovementRequestSchema } from "../../../../../packages/contracts/src/catalog";

import { isValidCalendarDate, isValidLocalTime } from "./movement-draft";

export type ReversalDraft = {
  occurredLocalDate: string;
  occurredLocalTime: string;
  reason: string;
};

export type ReversalDraftErrors = Partial<
  Record<"occurredLocalDate" | "occurredLocalTime" | "reason", string>
>;

export function buildReversalCommand(input: {
  draft: ReversalDraft;
  idempotencyKey: string;
}): { command: ReverseInventoryMovementRequest } | { errors: ReversalDraftErrors } {
  const errors: ReversalDraftErrors = {};
  const reason = input.draft.reason.trim();
  if (!reason || reason.length > 240) errors.reason = "invalid";
  if (!isValidCalendarDate(input.draft.occurredLocalDate)) {
    errors.occurredLocalDate = "invalid";
  }
  if (!isValidLocalTime(input.draft.occurredLocalTime)) {
    errors.occurredLocalTime = "invalid";
  }
  if (Object.keys(errors).length > 0) return { errors };
  const parsed = reverseInventoryMovementRequestSchema.safeParse({
    idempotencyKey: input.idempotencyKey,
    occurredLocalDate: input.draft.occurredLocalDate,
    occurredLocalTime: input.draft.occurredLocalTime,
    reason,
  });
  return parsed.success ? { command: parsed.data } : { errors: { reason: "invalid" } };
}
