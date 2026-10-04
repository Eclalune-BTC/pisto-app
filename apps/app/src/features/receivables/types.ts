import type { Receivable, ReceivablePayment, ReceivablesSummary } from "@pisto/contracts";

type ReadFailure =
  | { kind: "denied" }
  | { kind: "error" }
  | { kind: "loading" }
  | { kind: "offline" };

export type ReceivablesLoadState =
  | ReadFailure
  | { kind: "empty"; stale: boolean; summary: ReceivablesSummary }
  | {
      kind: "ready";
      items: Receivable[];
      loadingMore: boolean;
      nextCursor: string | null;
      stale: boolean;
      summary: ReceivablesSummary;
    };

export type ReceivableDetailLoadState =
  | ReadFailure
  | { kind: "notFound" }
  | {
      kind: "ready";
      customer: { active: boolean; id: string; name: string };
      payments: ReceivablePayment[];
      receivable: Receivable;
      stale: boolean;
    };

export type AccountNameCell =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; name: string };
