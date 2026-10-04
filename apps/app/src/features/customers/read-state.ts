import {
  hasDeniedRead,
  isPausedWithoutData,
  queryHasStaleData,
  readFailureKind,
} from "@/lib/query-state";

export type ReadQuery = {
  data: unknown;
  error: unknown;
  fetchStatus: "fetching" | "idle" | "paused";
  isError: boolean;
  isPending: boolean;
};

export type ReadState =
  | { kind: "denied" | "error" | "loading" | "notFound" | "offline" }
  | { kind: "ready"; stale: boolean };

/**
 * The combined state of the reads one screen needs together. An authoritative rejection hides
 * cached data, a paused read without data is offline rather than loading, a missing response is a
 * failure rather than an empty success, and cached data whose refresh failed stays visible as stale.
 */
export function readState(queries: readonly ReadQuery[]): ReadState {
  if (hasDeniedRead(queries)) return { kind: "denied" };
  if (queries.some((query) => isPausedWithoutData(query.fetchStatus, query.data !== undefined))) {
    return { kind: "offline" };
  }
  const failed = queries.find((query) => query.isError && query.data === undefined);
  if (failed) return { kind: readFailureKind(failed.error) };
  if (queries.some((query) => query.isPending)) return { kind: "loading" };
  if (queries.some((query) => query.data === undefined)) return { kind: "error" };
  return { kind: "ready", stale: queries.some(queryHasStaleData) };
}
