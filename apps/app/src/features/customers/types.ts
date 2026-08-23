import type {
  Customer,
  CustomerDetail,
  Receivable,
} from "../../../../../packages/contracts/src/receivables";

export type CustomersLoadState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "denied" }
  | { kind: "error" }
  | { kind: "empty" }
  | {
      kind: "ready";
      items: Customer[];
      loadingMore: boolean;
      nextCursor: string | null;
      stale: boolean;
    };

export type CustomerDetailLoadState =
  | { kind: "loading" }
  | { kind: "offline" }
  | { kind: "denied" }
  | { kind: "notFound" }
  | { kind: "error" }
  | {
      kind: "ready";
      detail: CustomerDetail;
      receivables: Receivable[];
      stale: boolean;
    };

export type MutationState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "uncertain"; message: string }
  | { kind: "succeeded" };

export type CustomersCopy = {
  archive: string;
  archived: string;
  archivedDescription: string;
  back: string;
  balance: string;
  contact: string;
  create: string;
  deniedDescription: string;
  deniedTitle: string;
  description: string;
  email: string;
  emptyAction: string;
  emptyDescription: string;
  emptyTitle: string;
  errorDescription: string;
  errorTitle: string;
  loadMore: string;
  loading: string;
  name: string;
  noContact: string;
  noReceivables: string;
  notes: string;
  offlineDescription: string;
  offlineTitle: string;
  openReceivables: string;
  overdue: string;
  phone: string;
  receivableHistory: string;
  retry: string;
  searchLabel: string;
  searchPlaceholder: string;
  stale: string;
  title: string;
  unavailableDescription: string;
  unavailableTitle: string;
  update: string;
};

export type CustomerFormCopy = {
  cancel: string;
  confirmArchive: string;
  email: string;
  name: string;
  notes: string;
  phone: string;
  retrySameRequest: string;
  save: string;
  uncertainTitle: string;
};

export function customerPrimaryAction(
  state: MutationState,
): "submit" | "retry" | "waiting" | "none" {
  if (state.kind === "idle" || state.kind === "error") return "submit";
  if (state.kind === "uncertain") return "retry";
  if (state.kind === "submitting") return "waiting";
  return "none";
}
