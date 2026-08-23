import { isAmbiguousMutationError } from "@/lib/api-error";

import { capabilityErrorMessage, customersReceivablesCopy } from "./copy";
import type { MutationState } from "./types";

export function customerMutationState(input: {
  error: unknown;
  isPending: boolean;
  isSuccess: boolean;
}): MutationState {
  if (input.isPending) return { kind: "submitting" };
  if (input.isSuccess) return { kind: "succeeded" };
  if (input.error) {
    const message = capabilityErrorMessage(
      input.error,
      customersReceivablesCopy.common.unavailableDescription,
    );
    return isAmbiguousMutationError(input.error)
      ? { kind: "uncertain", message }
      : { kind: "error", message };
  }
  return { kind: "idle" };
}
