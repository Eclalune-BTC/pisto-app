import type { QueryClient } from "@tanstack/react-query";

import { cashQueryKeys, expenseQueryKeys } from "./queries";

export async function invalidateCashLedger(queryClient: QueryClient, businessId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: cashQueryKeys.accounts(businessId) }),
    queryClient.invalidateQueries({ queryKey: cashQueryKeys.movements(businessId) }),
  ]);
}

export async function invalidateExpensesAndCash(queryClient: QueryClient, businessId: string) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: expenseQueryKeys.all(businessId) }),
    invalidateCashLedger(queryClient, businessId),
  ]);
}
