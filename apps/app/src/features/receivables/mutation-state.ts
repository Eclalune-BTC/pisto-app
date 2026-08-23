import type { QueryClient } from "@tanstack/react-query";

import { capabilityErrorMessage, customersReceivablesCopy } from "@/features/customers/copy";
import { customerQueryKeys } from "@/features/customers/queries";
import { isAmbiguousMutationError } from "@/lib/api-error";

import { receivableQueryKeys } from "./queries";
import type { FinancialMutationState } from "./types";

export function financialMutationState(input: {
  error: unknown;
  isPending: boolean;
  isSuccess: boolean;
}): FinancialMutationState {
  if (input.isPending) return { kind: "submitting" };
  if (input.isSuccess) return { kind: "confirmed" };
  if (input.error) {
    const message = capabilityErrorMessage(
      input.error,
      customersReceivablesCopy.common.unavailableDescription,
    );
    return isAmbiguousMutationError(input.error)
      ? { kind: "uncertain", message }
      : { kind: "error", message };
  }
  return { kind: "review" };
}

export async function invalidateReceivableMutation(
  queryClient: QueryClient,
  input: { businessId: string; customerId: string; receivableId?: string },
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all(input.businessId) }),
    queryClient.invalidateQueries({
      queryKey: customerQueryKeys.detail(input.businessId, input.customerId),
    }),
    queryClient.invalidateQueries({ queryKey: ["cash", input.businessId] }),
  ]);
}
