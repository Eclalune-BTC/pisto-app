import { isAmbiguousMutationError } from "@/lib/api-error";

import type { CashConfirmationState } from "./state";

export function cashConfirmationState(mutation: {
  error: unknown;
  isError: boolean;
  isPending: boolean;
}): CashConfirmationState {
  if (mutation.isPending) return "pending";
  if (!mutation.isError) return "idle";
  return isAmbiguousMutationError(mutation.error) ? "uncertain" : "failed";
}
