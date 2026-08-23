import { ApiClientError, isAmbiguousMutationError } from "@/lib/api-error";

export type MutationUiState = "error" | "idle" | "pending" | "uncertain";

export function mutationUiState(input: { error: unknown; isPending: boolean }): MutationUiState {
  if (input.isPending) return "pending";
  if (!input.error) return "idle";
  return isAmbiguousMutationError(input.error) ? "uncertain" : "error";
}

export function isDeniedError(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "FORBIDDEN";
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiClientError && error.code === "NOT_FOUND";
}

export function isOfflineWithoutData(input: {
  data: unknown;
  fetchStatus: "fetching" | "idle" | "paused";
}): boolean {
  return input.fetchStatus === "paused" && input.data === undefined;
}
