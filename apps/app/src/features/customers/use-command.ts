import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { isAmbiguousMutationError } from "@/lib/api-error";

import { type CommandState, commandState, provesNotCommitted } from "./command-state";

/**
 * The idempotency key whose outcome is still unknown once an attempt settles. An unknown outcome
 * marks its key; only a success or a rejection proving that key was never committed clears it.
 */
export function unresolvedKeyAfter(
  current: string | null,
  attemptKey: string,
  outcome: { error: unknown } | "success",
): string | null {
  if (outcome === "success") return current === attemptKey ? null : current;
  if (isAmbiguousMutationError(outcome.error)) return attemptKey;
  if (current === attemptKey && provesNotCommitted(outcome.error)) return null;
  return current;
}

export type Command<TVariables> = {
  /** Forgets a settled attempt before another command is prepared. */
  reset: () => void;
  /** Sends exactly these variables; a retry passes the same ones again. */
  send: (variables: TVariables) => void;
  state: CommandState;
};

/**
 * A reviewed command sent with an idempotency key. After an attempt with an unknown outcome, a
 * later failure of the same key stays uncertain unless it proves the key was never committed, so
 * the command can only be resent as is and never replaced by an edited one under a new key.
 */
export function useCommand<TVariables, TResult>({
  conflictMessage,
  keyOf,
  mutationFn,
  onConfirmed,
}: {
  conflictMessage?: string;
  keyOf: (variables: TVariables) => string;
  mutationFn: (variables: TVariables) => Promise<TResult>;
  onConfirmed: (result: TResult, variables: TVariables) => Promise<void> | void;
}): Command<TVariables> {
  const { t } = useTranslation();
  const [unresolvedKey, setUnresolvedKey] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn,
    onError: (error, variables) =>
      setUnresolvedKey((current) => unresolvedKeyAfter(current, keyOf(variables), { error })),
    onSuccess: async (result, variables) => {
      setUnresolvedKey((current) => unresolvedKeyAfter(current, keyOf(variables), "success"));
      await onConfirmed(result, variables);
    },
  });
  const unresolved =
    unresolvedKey !== null &&
    mutation.variables !== undefined &&
    keyOf(mutation.variables) === unresolvedKey;
  return {
    reset: mutation.reset,
    send: (variables) => mutation.mutate(variables),
    state: commandState(t, mutation, conflictMessage, unresolved),
  };
}
