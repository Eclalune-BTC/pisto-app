import type { TFunction } from "i18next";

import { ApiClientError, isAmbiguousMutationError } from "@/lib/api-error";
import { productErrorMessage } from "@/lib/product-errors";

/**
 * The single phase vocabulary of every reviewed customer and receivable command. `uncertain`
 * means the server may have committed the command, so only the identical command and idempotency
 * key may be sent again.
 */
export type CommandState =
  | { phase: "confirmed" | "idle" | "pending" }
  | { phase: "failed" | "uncertain"; message: string };

export type CommandAction = "confirm" | "none" | "retry" | "waiting";

/**
 * Whether the latest reads still allow a command editor to prepare and send a command. A stale
 * read blocks new reviews and first sends; an unavailable one closes the editor unless a command
 * may already have reached the server.
 */
export type EditorAvailability = "available" | "stale" | "unavailable";

/**
 * A rejection the server returns only after finding no receipt for the idempotency key in the same
 * transaction, so the key was never committed. Session, permission, rate, pause and request-shape
 * rejections happen before that lookup and prove nothing about an earlier attempt.
 */
export function provesNotCommitted(error: unknown): boolean {
  return (
    error instanceof ApiClientError && (error.code === "CONFLICT" || error.code === "NOT_FOUND")
  );
}

/**
 * @param unresolved an earlier attempt with the same idempotency key had an unknown outcome, so a
 * failure that does not prove the key was never committed leaves the command uncertain.
 */
export function commandState(
  t: TFunction,
  mutation: { error: unknown; isPending: boolean; isSuccess: boolean },
  conflictMessage?: string,
  unresolved = false,
): CommandState {
  if (mutation.isPending) return { phase: "pending" };
  if (mutation.isSuccess) return { phase: "confirmed" };
  if (!mutation.error) return { phase: "idle" };
  const message = productErrorMessage(
    mutation.error,
    t("relationships.command.failedDescription"),
    t,
  );
  if (
    isAmbiguousMutationError(mutation.error) ||
    (unresolved && !provesNotCommitted(mutation.error))
  ) {
    return { phase: "uncertain", message };
  }
  const conflict = mutation.error instanceof ApiClientError && mutation.error.code === "CONFLICT";
  return { phase: "failed", message: conflict && conflictMessage ? conflictMessage : message };
}

export function commandAction(state: CommandState): CommandAction {
  if (state.phase === "idle" || state.phase === "failed") return "confirm";
  if (state.phase === "uncertain") return "retry";
  if (state.phase === "pending") return "waiting";
  return "none";
}

/** The command reached or may have reached the server, so its review must stay on screen. */
export function commandInFlight(state: CommandState): boolean {
  return state.phase === "pending" || state.phase === "uncertain" || state.phase === "confirmed";
}

/** An uncertain outcome resends the identical command; any other confirmation builds a new one. */
export function commandToSend<T>(
  previous: T | null,
  state: CommandState,
  build: () => T | null,
): T | null {
  return previous !== null && state.phase === "uncertain" ? previous : build();
}

/** Closing a confirmation keeps an unresolved command so that reopening retries the same key. */
export function commandAfterClose<T>(previous: T | null, state: CommandState): T | null {
  return state.phase === "uncertain" ? previous : null;
}
