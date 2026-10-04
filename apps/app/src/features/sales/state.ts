import {
  type Sale,
  type SaleList,
  type SaleStatusFilter,
  saleStatusFilterSchema,
} from "@pisto/contracts";
import type { InfiniteData } from "@tanstack/react-query";

import { isAccessDeniedError, queryHasStaleData } from "@/lib/query-state";

export const saleStatusFilters: readonly SaleStatusFilter[] = ["all", "posted", "voided"];

/** The URL filter is optional; an absent or unknown value means the contract's default, all. */
export function parseSaleStatusFilter(value: string | string[] | undefined): SaleStatusFilter {
  const parsed = saleStatusFilterSchema.safeParse(Array.isArray(value) ? value[0] : value);
  return parsed.success ? parsed.data : "all";
}

type ReadQuery = {
  data: unknown;
  error: unknown;
  fetchStatus: "fetching" | "paused" | "idle";
  isError: boolean;
};

export type ReadState = "denied" | "offline" | "error" | "loading" | "ready";

/**
 * The state of the reads a region needs, worst first. An access rejection overrides cached data;
 * a paused read never reports an error, so it is told apart from loading before the pending check.
 */
export function readState(queries: readonly ReadQuery[]): ReadState {
  if (queries.some(({ error }) => isAccessDeniedError(error))) return "denied";
  const failed = queries.find(({ data, isError }) => isError && data === undefined);
  if (failed) return failed.fetchStatus === "paused" ? "offline" : "error";
  if (queries.some(({ data, fetchStatus }) => fetchStatus === "paused" && data === undefined)) {
    return "offline";
  }
  if (queries.some(({ data }) => data === undefined)) return "loading";
  return "ready";
}

type HistoryQuery = ReadQuery & {
  data: InfiniteData<SaleList> | undefined;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
};

export type SalesHistoryState =
  | { kind: "denied" }
  | { kind: "offline" }
  | { kind: "error" }
  | { kind: "loading" }
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
 * `queriedAt` only exists on a state built from a page the server answered, so a failed read can
 * never render as an empty history. Correction is withdrawn while the page is stale: confirming a
 * financial correction against figures that could not be refreshed is a decision nobody can verify.
 */
export function salesHistoryState(input: {
  accessStale: boolean;
  canCorrect: boolean;
  canRead: boolean;
  query: HistoryQuery;
}): SalesHistoryState {
  if (!input.canRead) return { kind: "denied" };
  const read = readState([input.query]);
  if (read !== "ready") return { kind: read };
  const pages = input.query.data?.pages;
  // The first page is the oldest read on screen, so it is the honest freshness claim.
  const firstPage = pages?.[0];
  if (!pages || !firstPage) throw new Error("An answered sales history must have a first page.");
  const stale = input.accessStale || queryHasStaleData(input.query);
  const items = pages.flatMap((page) => page.items);
  if (items.length === 0) return { kind: "empty", queriedAt: firstPage.queriedAt, stale };
  return {
    kind: "ready",
    canCorrect: input.canCorrect && !stale,
    hasMore: input.query.hasNextPage,
    items,
    loadingMore: input.query.isFetchingNextPage,
    queriedAt: firstPage.queriedAt,
    stale,
  };
}

export function canCorrectSale(sale: Sale): boolean {
  return sale.status === "posted" && sale.correction === null;
}
