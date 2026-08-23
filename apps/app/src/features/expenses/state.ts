import type { Expense, ExpensePeriodSummary } from "../../../../../packages/contracts/src/cash.ts";

import type { CashConfirmationState } from "../cash/state";

export type ExpensesScreenState =
  | { kind: "loading" }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      expenses: Expense[];
      summary: ExpensePeriodSummary;
      canManage: boolean;
      isStale: boolean;
      confirmation: CashConfirmationState;
      mutationMessage?: string;
    };

export type ExpensesScreenPresentation = {
  showCreate: boolean;
  showHistory: boolean;
  showRetry: boolean;
  blocksDuplicateMutation: boolean;
};

export function expensesScreenPresentation(state: ExpensesScreenState): ExpensesScreenPresentation {
  return {
    showCreate: state.kind === "ready" && state.canManage && state.confirmation !== "uncertain",
    showHistory: state.kind === "ready" && state.expenses.length > 0,
    showRetry:
      state.kind === "error" || (state.kind === "ready" && state.confirmation === "failed"),
    blocksDuplicateMutation: state.kind === "ready" && state.confirmation === "uncertain",
  };
}
