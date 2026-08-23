import { ApiClientError } from "@/lib/api-error";

export type ReadFailureKind = "denied" | "error" | "notFound";

export function readFailureKind(error: unknown): ReadFailureKind {
  if (error instanceof ApiClientError) {
    if (error.status === 403) return "denied";
    if (error.status === 404) return "notFound";
  }
  return "error";
}

export function isPausedWithoutData(fetchStatus: string, hasData: boolean): boolean {
  return fetchStatus === "paused" && !hasData;
}
