import { ApiClientError, isAmbiguousMutationError } from "@/lib/api-error";

import { catalogInventoryCopy } from "./copy";

export type MutationContext = "archiveProduct" | "category" | "movement" | "product" | "reversal";

export type MutationUiState = "error" | "idle" | "pending" | "uncertain";

export function mutationUiState(input: { error: unknown; isPending: boolean }): MutationUiState {
  if (input.isPending) return "pending";
  if (!input.error) return "idle";
  return isAmbiguousMutationError(input.error) ? "uncertain" : "error";
}

export function mutationErrorMessage(error: unknown, context: MutationContext): string {
  const copy = catalogInventoryCopy.errors[context];
  if (!(error instanceof ApiClientError)) return copy.fallback;
  if (error.status === 0 || error.status >= 500) return catalogInventoryCopy.errors.connection;
  switch (error.code) {
    case "BUSINESS_REQUIRED":
      return catalogInventoryCopy.errors.businessRequired;
    case "CONFLICT":
      return copy.conflict;
    case "FORBIDDEN":
      return copy.forbidden;
    case "IDEMPOTENCY_CONFLICT":
      return copy.idempotency;
    case "NOT_FOUND":
      return copy.notFound;
    case "VALIDATION_ERROR":
      return copy.validation;
    default:
      return copy.fallback;
  }
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
