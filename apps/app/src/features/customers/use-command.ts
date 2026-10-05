import { useTranslation } from "react-i18next";
import { useKeyedCommand } from "@/lib/keyed-command";
import { type CommandState, commandState } from "./command-state";

export type Command<TVariables> = {
  /** Forgets a settled attempt before another command is prepared. */
  reset: () => void;
  /** Sends exactly these variables; a retry passes the same ones again. */
  send: (variables: TVariables) => void;
  state: CommandState;
};

/** A keyed command whose state carries the customers and receivables messages. */
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
  const command = useKeyedCommand({ keyOf, mutationFn, onConfirmed });
  return {
    reset: command.reset,
    send: command.send,
    state: commandState(t, command, conflictMessage, command.unresolved),
  };
}
