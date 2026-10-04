import { isAmbiguousMutationError } from "@/lib/api-error";

/**
 * Where a confirmed money command stands. "uncertain" means the server may already have applied
 * it, so the only safe next step is sending the same command (same idempotency key) again.
 */
export type MutationPhase = "idle" | "pending" | "failed" | "uncertain";

export function mutationPhase(mutation: {
  error: unknown;
  isError: boolean;
  isPending: boolean;
}): MutationPhase {
  if (mutation.isPending) return "pending";
  if (!mutation.isError) return "idle";
  return isAmbiguousMutationError(mutation.error) ? "uncertain" : "failed";
}

/** While a command is in flight or its outcome is unknown, its inputs and exits stay frozen. */
export function isLockedPhase(phase: MutationPhase): boolean {
  return phase === "pending" || phase === "uncertain";
}

/** An unchanged command keeps its key so that sending it again replays instead of duplicating. */
export function withStableIdempotencyKey<T extends { idempotencyKey: string }>(
  previous: T | undefined,
  next: T,
): T {
  if (!previous) return next;
  const { idempotencyKey: _previousKey, ...previousPayload } = previous;
  const { idempotencyKey: _nextKey, ...nextPayload } = next;
  return JSON.stringify(previousPayload) === JSON.stringify(nextPayload) ? previous : next;
}
