import type {
  Receivable,
  ReceivablePayment,
  ReceivablesSummary,
} from "../../../../../packages/contracts/src/receivables";

export type ReceivablesLoadState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "denied" }
  | { kind: "error" }
  | { kind: "empty"; summary: ReceivablesSummary }
  | {
      kind: "ready";
      items: Receivable[];
      loadingMore: boolean;
      nextCursor: string | null;
      stale: boolean;
      summary: ReceivablesSummary;
    };

export type ReceivableDetailLoadState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "denied" }
  | { kind: "notFound" }
  | { kind: "error" }
  | {
      kind: "ready";
      payments: ReceivablePayment[];
      receivable: Receivable;
      stale: boolean;
    };

export type FinancialMutationState =
  | { kind: "review" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "uncertain"; message: string }
  | { kind: "confirmed" };

export type ReceivablesCopy = {
  all: string;
  applyPayment: string;
  back: string;
  cashAccount: string;
  charge: string;
  confirmed: string;
  deniedDescription: string;
  deniedTitle: string;
  description: string;
  dueDate: string;
  emptyAction: string;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  filterLabel: string;
  loadMore: string;
  loading: string;
  noDueDate: string;
  noPayments: string;
  offlineDescription: string;
  offlineTitle: string;
  open: string;
  openCount: string;
  originalAmount: string;
  outstanding: string;
  overdue: string;
  overdueCount: string;
  paid: string;
  paymentHistory: string;
  postedDate: string;
  retry: string;
  reverse: string;
  reversedPayment: string;
  stale: string;
  title: string;
  unavailableDescription: string;
  unavailableTitle: string;
  void: string;
  voided: string;
};

export type ConfirmationCopy = {
  cancel: string;
  confirm: string;
  confirming: string;
  errorTitle: string;
  retrySameCommand: string;
  reviewTitle: string;
  uncertainDescription: string;
  uncertainTitle: string;
};

export type ConfirmationField = { label: string; value: string };

export type ReceivableFormCopy = {
  amount: string;
  cancel: string;
  chooseCustomer: string;
  customer: string;
  description: string;
  dueDate: string;
  optional: string;
  postedDate: string;
  review: string;
};

export type PaymentFormCopy = {
  amount: string;
  cancel: string;
  cashAccount: string;
  chooseCashAccount: string;
  date: string;
  optional: string;
  reference: string;
  review: string;
  time: string;
};

export type PaymentReversalFormCopy = {
  cancel: string;
  date: string;
  optional: string;
  reference: string;
  review: string;
  time: string;
};

export type VoidReceivableFormCopy = {
  cancel: string;
  reason: string;
  review: string;
};

export type ReceivableReviewCopy = ConfirmationCopy & {
  amount: string;
  cashAccount: string;
  customer: string;
  description: string;
  dueDate: string;
  noDueDate: string;
  occurrence: string;
  originalPayment: string;
  postedDate: string;
  reason: string;
  reference: string;
};

export function financialMutationAction(
  state: FinancialMutationState,
): "confirm" | "retry" | "waiting" | "none" {
  if (state.kind === "review" || state.kind === "error") return "confirm";
  if (state.kind === "uncertain") return "retry";
  if (state.kind === "submitting") return "waiting";
  return "none";
}
