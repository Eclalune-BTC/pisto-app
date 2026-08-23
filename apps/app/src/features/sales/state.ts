import type { Sale, SaleStatusFilter } from "@pisto/contracts";

import type { FeatureRemoteState } from "../cash/feature-boundary";

export const saleStatusFilters: readonly SaleStatusFilter[] = ["all", "posted", "voided"];

export type SalesHistoryState =
  | { kind: "loading" }
  | { kind: "offline"; message: string }
  | { kind: "denied" }
  | { kind: "error"; message: string }
  | { kind: "empty"; queriedAt: string; stale: boolean }
  | {
      kind: "ready";
      canCorrect: boolean;
      hasMore: boolean;
      items: Sale[];
      loadingMore: boolean;
      queriedAt: string;
      stale: boolean;
    };

/**
 * `queriedAt` only exists on a state built from a page the server answered, so a
 * failed read cannot be rendered as an empty history. Correction is withdrawn
 * while the page is stale: confirming a financial correction against numbers
 * that could not be refreshed is a decision nobody can verify.
 */
export function salesHistoryState(input: {
  canCorrect: boolean;
  hasMore: boolean;
  items: Sale[];
  loadingMore: boolean;
  queriedAt: string | undefined;
  remote: FeatureRemoteState;
  stale: boolean;
}): SalesHistoryState {
  if (input.remote.kind !== "ready") return input.remote;
  if (input.queriedAt === undefined) return { kind: "loading" };
  if (input.items.length === 0) {
    return { kind: "empty", queriedAt: input.queriedAt, stale: input.stale };
  }
  return {
    kind: "ready",
    canCorrect: input.canCorrect && !input.stale,
    hasMore: input.hasMore,
    items: input.items,
    loadingMore: input.loadingMore,
    queriedAt: input.queriedAt,
    stale: input.stale,
  };
}
