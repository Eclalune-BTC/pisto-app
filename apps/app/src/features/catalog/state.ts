import { isAccessDeniedError, queryHasStaleData, readFailureKind } from "@/lib/query-state";

type Read = {
  data: unknown;
  error: unknown;
  fetchStatus: "fetching" | "paused" | "idle";
  isError: boolean;
};

export type ReadState = "denied" | "offline" | "error" | "notFound" | "loading" | "ready";

/**
 * The state of the reads a screen needs, worst first. An access rejection overrides cached data,
 * and a read paused for connectivity never reports an error, so it is told apart from loading.
 * A read skipped for missing context stays "loading"; callers check access before asking.
 */
export function readState(reads: readonly Read[]): ReadState {
  if (reads.some(({ error }) => isAccessDeniedError(error))) return "denied";
  const failed = reads.find(({ data, isError }) => isError && data === undefined);
  if (failed) {
    if (failed.fetchStatus === "paused") return "offline";
    return readFailureKind(failed.error) === "notFound" ? "notFound" : "error";
  }
  if (reads.some(({ data, fetchStatus }) => fetchStatus === "paused" && data === undefined)) {
    return "offline";
  }
  if (reads.some(({ data }) => data === undefined)) return "loading";
  return "ready";
}

/** Cached records whose refresh failed or paused; commands wait until they are current. */
export function hasStaleRead(reads: readonly Read[]): boolean {
  return reads.some(queryHasStaleData);
}
