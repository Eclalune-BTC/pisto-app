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

export function commandState(
  t: TFunction,
  mutation: { error: unknown; isPending: boolean; isSuccess: boolean },
  conflictMessage?: string,
): CommandState {
  if (mutation.isPending) return { phase: "pending" };
  if (mutation.isSuccess) return { phase: "confirmed" };
  if (!mutation.error) return { phase: "idle" };
  const message = productErrorMessage(
    mutation.error,
    t("relationships.command.failedDescription"),
    t,
  );
  if (isAmbiguousMutationError(mutation.error)) return { phase: "uncertain", message };
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
