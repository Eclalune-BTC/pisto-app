import type { TFunction } from "i18next";

import { isAmbiguousMutationError } from "@/lib/api-error";
import { productErrorMessage } from "@/lib/product-errors";

import type { MutationState } from "./types";

export function customerMutationState(
  t: TFunction,
  input: {
    error: unknown;
    isPending: boolean;
    isSuccess: boolean;
  },
): MutationState {
  if (input.isPending) return { kind: "submitting" };
  if (input.isSuccess) return { kind: "succeeded" };
  if (input.error) {
    const message = productErrorMessage(
      input.error,
      t("relationships.common.unavailableDescription"),
      t,
    );
    return isAmbiguousMutationError(input.error)
      ? { kind: "uncertain", message }
      : { kind: "error", message };
  }
  return { kind: "idle" };
}
