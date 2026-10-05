import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { isAmbiguousMutationError } from "@/lib/api-error";
import { type MutationPhase, mutationPhase, provesNotCommitted } from "@/lib/mutation-phase";

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

/**
 * The phase of a keyed command. After an attempt with an unknown outcome, a later failure of the
 * same key stays uncertain unless it proves the key was never committed: a rate limit, a paused
 * write or a lost session is refused before the server looks the key up.
 */
export function keyedCommandPhase<TVariables>(
  mutation: { error: unknown; isError: boolean; isPending: boolean; variables?: TVariables },
  unresolvedKey: string | null,
  keyOf: (variables: TVariables) => string = idempotencyKeyOf,
): MutationPhase {
  const unresolved =
    unresolvedKey !== null &&
    mutation.variables !== undefined &&
    keyOf(mutation.variables) === unresolvedKey;
  if (mutation.isError && unresolved && !provesNotCommitted(mutation.error)) return "uncertain";
  return mutationPhase(mutation);
}

function idempotencyKeyOf(variables: unknown): string {
  return (variables as { idempotencyKey: string }).idempotencyKey;
}

/**
 * A reviewed command sent with an idempotency key. `send` passes exactly the given variables, so a
 * retry of an uncertain command resends the same key, and a later failure of that key stays
 * uncertain until it is proven never committed: the command can only be resent as is, never
 * replaced by an edited one under a new key.
 */
export function useKeyedCommand<TVariables, TResult>({
  keyOf = idempotencyKeyOf,
  mutationFn,
  onConfirmed,
  onRejected,
}: {
  /** Where the idempotency key lives when the variables wrap the command. */
  keyOf?: (variables: TVariables) => string;
  mutationFn: (variables: TVariables) => Promise<TResult>;
  onConfirmed: (result: TResult, variables: TVariables) => Promise<void> | void;
  onRejected?: (error: unknown) => void;
}) {
  const [unresolvedKey, setUnresolvedKey] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn,
    onError: (error, variables) => {
      setUnresolvedKey((current) => unresolvedKeyAfter(current, keyOf(variables), { error }));
      onRejected?.(error);
    },
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
    error: mutation.error,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    phase: keyedCommandPhase(mutation, unresolvedKey, keyOf),
    /** Forgets a settled attempt before another command is prepared. */
    reset: mutation.reset,
    send: (variables: TVariables) => mutation.mutate(variables),
    /** An earlier attempt of the current key had an unknown outcome. */
    unresolved,
    /** The last command sent, which an uncertain retry must send again unchanged. */
    variables: mutation.variables,
  };
}
