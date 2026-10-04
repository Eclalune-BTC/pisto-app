import type { QueryClient } from "@tanstack/react-query";

import { cashQueryKeys } from "@/features/cash/queries";
import { customerQueryKeys } from "@/features/customers/queries";
import { reportsQueryKeys } from "@/features/reports/queries";

import { receivableQueryKeys } from "./queries";

/**
 * Every receivable command changes derived balances; payments and reversals also move money in a
 * cash account, so the business-scoped cash reads refresh with them.
 */
export async function invalidateReceivableMutation(
  queryClient: QueryClient,
  input: { businessId: string; customerId: string },
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: reportsQueryKeys.all(input.businessId) }),
    queryClient.invalidateQueries({ queryKey: receivableQueryKeys.all(input.businessId) }),
    queryClient.invalidateQueries({
      queryKey: customerQueryKeys.detail(input.businessId, input.customerId),
    }),
    queryClient.invalidateQueries({ queryKey: cashQueryKeys.all(input.businessId) }),
  ]);
}
