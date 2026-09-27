import {
  calendarLocalDateSchema,
  localTimeSchema,
  type ReverseInventoryMovementRequest,
  reverseInventoryMovementRequestSchema,
} from "@pisto/contracts";

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
  if (!calendarLocalDateSchema.safeParse(input.draft.occurredLocalDate).success) {
    errors.occurredLocalDate = "invalid";
  }
  if (!localTimeSchema.safeParse(input.draft.occurredLocalTime).success) {
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
