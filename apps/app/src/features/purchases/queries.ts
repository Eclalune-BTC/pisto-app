import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  skipToken,
} from "@tanstack/react-query";

import { cashQueryKeys } from "@/features/cash/queries";
import { catalogInventoryQueryKeys } from "@/features/catalog/queries";
import { reportsQueryKeys } from "@/features/reports/queries";

import { purchasesApi } from "./api";

export const PURCHASES_PAGE_SIZE = 25;

export type SupplierListFilters = {
  balance: "all" | "outstanding";
  query?: string;
  status: "active" | "archived" | "all";
};

export type PurchaseListFilters = {
  payable: "all" | "open" | "paid";
  status: "all" | "posted" | "voided";
  supplierId?: string;
};

export const purchaseQueryKeys = {
  all: (businessId: string | undefined) => ["purchases", businessId] as const,
  suppliers: (businessId: string | undefined, filters: SupplierListFilters) =>
    [...purchaseQueryKeys.all(businessId), "suppliers", filters] as const,
  supplier: (businessId: string | undefined, supplierId: string | undefined) =>
    [...purchaseQueryKeys.all(businessId), "supplier", supplierId] as const,
  purchases: (businessId: string | undefined, filters: PurchaseListFilters | undefined) =>
    [...purchaseQueryKeys.all(businessId), "list", filters] as const,
  purchase: (businessId: string | undefined, purchaseId: string | undefined) =>
    [...purchaseQueryKeys.all(businessId), "detail", purchaseId] as const,
  summary: (businessId: string | undefined) =>
    [...purchaseQueryKeys.all(businessId), "summary"] as const,
};

export function suppliersQueryOptions(
  businessId: string | undefined,
  filters: SupplierListFilters,
) {
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: purchaseQueryKeys.suppliers(businessId, filters),
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          purchasesApi.suppliers.list(
            {
              balance: filters.balance,
              cursor: pageParam ?? undefined,
              limit: PURCHASES_PAGE_SIZE,
              query: filters.query,
              status: filters.status,
            },
            signal,
          )
      : skipToken,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function supplierQueryOptions(
  businessId: string | undefined,
  supplierId: string | undefined,
) {
  return queryOptions({
    queryKey: purchaseQueryKeys.supplier(businessId, supplierId),
    queryFn:
      businessId && supplierId
        ? ({ signal }) => purchasesApi.suppliers.get(supplierId, signal)
        : skipToken,
  });
}

export function purchasesQueryOptions(
  businessId: string | undefined,
  filters: PurchaseListFilters | undefined,
) {
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: purchaseQueryKeys.purchases(businessId, filters),
    queryFn:
      businessId && filters
        ? ({ pageParam, signal }) =>
            purchasesApi.purchases.list(
              {
                cursor: pageParam ?? undefined,
                limit: PURCHASES_PAGE_SIZE,
                payable: filters.payable,
                status: filters.status,
                supplierId: filters.supplierId,
              },
              signal,
            )
        : skipToken,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function purchaseQueryOptions(
  businessId: string | undefined,
  purchaseId: string | undefined,
) {
  return queryOptions({
    queryKey: purchaseQueryKeys.purchase(businessId, purchaseId),
    queryFn:
      businessId && purchaseId
        ? ({ signal }) => purchasesApi.purchases.get(purchaseId, signal)
        : skipToken,
  });
}

export function payablesSummaryQueryOptions(businessId: string | undefined) {
  return queryOptions({
    queryKey: purchaseQueryKeys.summary(businessId),
    queryFn: businessId ? ({ signal }) => purchasesApi.payablesSummary(signal) : skipToken,
  });
}

/**
 * A purchase command changes payables and supplier balances; paying moves cash, receiving or
 * voiding moves stock, and reports read both.
 */
export async function invalidatePurchaseMutation(
  queryClient: QueryClient,
  businessId: string,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: purchaseQueryKeys.all(businessId) }),
    queryClient.invalidateQueries({ queryKey: cashQueryKeys.all(businessId) }),
    queryClient.invalidateQueries({ queryKey: catalogInventoryQueryKeys.business(businessId) }),
    queryClient.invalidateQueries({ queryKey: reportsQueryKeys.all(businessId) }),
  ]);
}
