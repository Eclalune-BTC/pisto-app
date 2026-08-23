import type { SaleStatusFilter } from "@pisto/contracts";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

const pageSize = 25;

export const saleQueryKeys = {
  all: (businessId: string) => ["sales", businessId] as const,
  details: (businessId: string) => [...saleQueryKeys.all(businessId), "detail"] as const,
  detail: (businessId: string, saleId: string) =>
    [...saleQueryKeys.details(businessId), saleId] as const,
  lists: (businessId: string) => [...saleQueryKeys.all(businessId), "list"] as const,
  list: (businessId: string, status: SaleStatusFilter) =>
    [...saleQueryKeys.lists(businessId), status] as const,
  previousMonthSummary: (businessId: string) =>
    [...saleQueryKeys.all(businessId), "summary", "previous-month"] as const,
} as const;

export function salesInfiniteOptions(businessId: string, status: SaleStatusFilter) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.sales.list({ cursor: pageParam, limit: pageSize, status }),
    queryKey: saleQueryKeys.list(businessId, status),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function saleQueryOptions(businessId: string, saleId: string) {
  return queryOptions({
    queryFn: () => api.sales.get(saleId),
    queryKey: saleQueryKeys.detail(businessId, saleId),
  });
}

export function previousMonthSummaryQueryOptions(businessId: string) {
  return queryOptions({
    queryFn: api.sales.previousMonthSummary,
    queryKey: saleQueryKeys.previousMonthSummary(businessId),
  });
}
