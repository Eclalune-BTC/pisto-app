import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { unresolvedKeyAfter } from "@/features/customers/use-command";
import { type MutationPhase, mutationPhase, provesNotCommitted } from "@/lib/mutation-phase";

type KeyedVariables = { idempotencyKey: string };

/**
 * The phase of a keyed command. After an attempt with an unknown outcome, a later failure of the
 * same key stays uncertain unless it proves the key was never committed: a rate limit, a paused
 * write or a lost session is refused before the server looks the key up.
 */
export function keyedCommandPhase(
  mutation: { error: unknown; isError: boolean; isPending: boolean; variables?: KeyedVariables },
  unresolvedKey: string | null,
): MutationPhase {
  const unresolved = unresolvedKey !== null && mutation.variables?.idempotencyKey === unresolvedKey;
  if (mutation.isError && unresolved && !provesNotCommitted(mutation.error)) return "uncertain";
  return mutationPhase(mutation);
}

/**
 * A reviewed catalog or inventory command sent with an idempotency key. `send` passes exactly the
 * given variables, so a retry of an uncertain command resends the same key.
 */
export function useKeyedCommand<TVariables extends KeyedVariables, TResult>({
  mutationFn,
  onConfirmed,
  onRejected,
}: {
  mutationFn: (variables: TVariables) => Promise<TResult>;
  onConfirmed: (result: TResult, variables: TVariables) => Promise<void> | void;
  onRejected?: (error: unknown) => void;
}) {
  const [unresolvedKey, setUnresolvedKey] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn,
    onError: (error, variables) => {
      setUnresolvedKey((current) =>
        unresolvedKeyAfter(current, variables.idempotencyKey, { error }),
      );
      onRejected?.(error);
    },
    onSuccess: async (result, variables) => {
      setUnresolvedKey((current) =>
        unresolvedKeyAfter(current, variables.idempotencyKey, "success"),
      );
      await onConfirmed(result, variables);
    },
  });
  return {
    error: mutation.error,
    phase: keyedCommandPhase(mutation, unresolvedKey),
    /** Forgets a settled attempt before another command is prepared. */
    reset: mutation.reset,
    send: (variables: TVariables) => mutation.mutate(variables),
    /** The last command sent, which an uncertain retry must send again unchanged. */
    variables: mutation.variables,
  };
}
