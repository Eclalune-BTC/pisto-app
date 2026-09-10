import { ApiClientError } from "./api-error";

export type ReadFailureKind = "denied" | "error" | "notFound";

export function isAccessDeniedError(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 401 ||
      error.status === 403 ||
      error.code === "UNAUTHORIZED" ||
      error.code === "FORBIDDEN")
  );
}

export function hasDeniedRead(queries: readonly { error: unknown }[]): boolean {
  return queries.some(({ error }) => isAccessDeniedError(error));
}

export function readFailureKind(error: unknown): ReadFailureKind {
  if (isAccessDeniedError(error)) return "denied";
  if (error instanceof ApiClientError) {
    if (error.status === 404) return "notFound";
  }
  return "error";
}

export function isPausedWithoutData(fetchStatus: string, hasData: boolean): boolean {
  return fetchStatus === "paused" && !hasData;
}

/** Cached data whose refresh failed or paused for connectivity. */
export function queryHasStaleData(query: {
  data: unknown;
  fetchStatus: "fetching" | "paused" | "idle";
  isError: boolean;
}): boolean {
  if (query.data === undefined) return false;
  return query.isError || query.fetchStatus === "paused";
}
