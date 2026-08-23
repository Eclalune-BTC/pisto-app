import type { CashAccount, CashMovement } from "../../../../../packages/contracts/src/cash.ts";

export type CashConfirmationState = "idle" | "pending" | "failed" | "uncertain";

export type CashScreenState =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      accounts: CashAccount[];
      movements: CashMovement[];
      canManage: boolean;
      confirmation: CashConfirmationState;
      mutationMessage?: string;
    };

export type CashScreenPresentation = {
  showAccounts: boolean;
  showCreate: boolean;
  showRetry: boolean;
  blocksDuplicateMutation: boolean;
};

export function cashScreenPresentation(state: CashScreenState): CashScreenPresentation {
  return {
    showAccounts: state.kind === "ready" && state.accounts.length > 0,
    showCreate: state.kind === "ready" && state.canManage && state.confirmation !== "uncertain",
    showRetry:
      state.kind === "error" || (state.kind === "ready" && state.confirmation === "failed"),
    blocksDuplicateMutation: state.kind === "ready" && state.confirmation === "uncertain",
  };
}
