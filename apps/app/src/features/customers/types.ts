import type { Customer, CustomerDetail, Receivable } from "@pisto/contracts";

type ReadFailure =
  | { kind: "denied" }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "offline" };

export type CustomersLoadState =
  | ReadFailure
  | { kind: "empty"; stale: boolean }
  | {
      kind: "ready";
      items: Customer[];
      loadingMore: boolean;
      nextCursor: string | null;
      stale: boolean;
    };

/** A list row's balance comes from its own detail read, so each cell owns its state. */
export type CustomerBalanceCell =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; balance: CustomerDetail["balance"] };

export type CustomerReceivablesState =
  | ReadFailure
  | { kind: "ready"; items: Receivable[]; loadingMore: boolean; nextCursor: string | null };

export type CustomerDetailLoadState =
  | ReadFailure
  | { kind: "notFound" }
  | {
      kind: "ready";
      detail: CustomerDetail;
      receivables: CustomerReceivablesState;
      stale: boolean;
    };
