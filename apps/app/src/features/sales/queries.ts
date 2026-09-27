import type { SaleStatusFilter } from "@pisto/contracts";
import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

const pageSize = 25;

export const saleQueryKeys = {
  all: (businessId: string | undefined) => ["sales", businessId] as const,
  review: (businessId: string | undefined) => [...saleQueryKeys.all(businessId), "review"] as const,
  details: (businessId: string | undefined) =>
    [...saleQueryKeys.all(businessId), "detail"] as const,
  detail: (businessId: string | undefined, saleId: string | undefined) =>
    [...saleQueryKeys.details(businessId), saleId] as const,
  lists: (businessId: string | undefined) => [...saleQueryKeys.all(businessId), "list"] as const,
  list: (businessId: string | undefined, status: SaleStatusFilter) =>
    [...saleQueryKeys.lists(businessId), status] as const,
  previousMonthSummary: (businessId: string | undefined) =>
    [...saleQueryKeys.all(businessId), "summary", "previous-month"] as const,
} as const;

export function salesInfiniteOptions(businessId: string | undefined, status: SaleStatusFilter) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          api.sales.list({ cursor: pageParam, limit: pageSize, status }, signal)
      : skipToken,
    queryKey: saleQueryKeys.list(businessId, status),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function saleQueryOptions(businessId: string | undefined, saleId: string | undefined) {
  return queryOptions({
    queryFn: businessId && saleId ? ({ signal }) => api.sales.get(saleId, signal) : skipToken,
    queryKey: saleQueryKeys.detail(businessId, saleId),
  });
}

export function saleReviewQueryOptions(businessId: string | undefined) {
  return queryOptions({
    queryFn: businessId ? ({ signal }) => api.sales.review.get(signal) : skipToken,
    queryKey: saleQueryKeys.review(businessId),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function previousMonthSummaryQueryOptions(businessId: string | undefined) {
  return queryOptions({
    queryFn: businessId ? ({ signal }) => api.sales.previousMonthSummary(signal) : skipToken,
    queryKey: saleQueryKeys.previousMonthSummary(businessId),
  });
}
