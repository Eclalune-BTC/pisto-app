import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { type CommandState, commandAfterClose, commandState, commandToSend } from "./command-state";

export type ConfirmableCommand<TCommand> = {
  /** The command last sent; it survives closing while its outcome is uncertain. */
  command: TCommand | null;
  confirm: (build: () => TCommand | null) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Changes for every fresh confirmation so its inputs start empty. */
  session: number;
  state: CommandState;
};

/**
 * A command confirmed inside a dialog. The dialog cannot close while the request is pending, and an
 * uncertain outcome keeps the exact command and idempotency key for the next confirmation.
 */
export function useConfirmableCommand<TCommand, TResult>({
  conflictMessage,
  mutationFn,
  onConfirmed,
}: {
  conflictMessage: string;
  mutationFn: (command: TCommand) => Promise<TResult>;
  onConfirmed: (result: TResult) => Promise<void>;
}): ConfirmableCommand<TCommand> {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const [command, setCommand] = useState<TCommand | null>(null);
  const mutation = useMutation({
    mutationFn,
    onSuccess: async (result) => {
      await onConfirmed(result);
      setOpen(false);
      setCommand(null);
    },
  });
  const state = commandState(t, mutation, conflictMessage);

  return {
    command,
    confirm: (build) => {
      const next = commandToSend(command, state, build);
      if (next === null) return;
      setCommand(next);
      mutation.mutate(next);
    },
    onOpenChange: (next) => {
      if (next) {
        if (command === null) {
          mutation.reset();
          setSession((current) => current + 1);
        }
        setOpen(true);
        return;
      }
      if (state.phase === "pending") return;
      setOpen(false);
      const kept = commandAfterClose(command, state);
      setCommand(kept);
      if (kept === null) mutation.reset();
    },
    open,
    session,
    state,
  };
}
