import type { SaleStatusFilter } from "@pisto/contracts";
import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  skipToken,
} from "@tanstack/react-query";

import { reportsQueryKeys } from "@/features/reports/queries";
import { api } from "@/lib/api-client";

export const SALES_PAGE_SIZE = 25;

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
  formOptions: (businessId: string | undefined) =>
    [...saleQueryKeys.all(businessId), "form-options"] as const,
  previousMonthSummary: (businessId: string | undefined) =>
    [...saleQueryKeys.all(businessId), "summary", "previous-month"] as const,
} as const;

export function salesInfiniteOptions(businessId: string | undefined, status: SaleStatusFilter) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          api.sales.list({ cursor: pageParam, limit: SALES_PAGE_SIZE, status }, signal)
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

/** Payment accounts a seller may choose, without balances. */
export function saleFormOptionsQueryOptions(businessId: string | undefined) {
  return queryOptions({
    queryFn: businessId ? ({ signal }) => api.sales.formOptions(signal) : skipToken,
    queryKey: saleQueryKeys.formOptions(businessId),
  });
}

export function previousMonthSummaryQueryOptions(businessId: string | undefined) {
  return queryOptions({
    queryFn: businessId ? ({ signal }) => api.sales.previousMonthSummary(signal) : skipToken,
    queryKey: saleQueryKeys.previousMonthSummary(businessId),
  });
}

/**
 * An itemized sale and its void also move stock, cash and debts, so every read of the business is
 * refreshed, as a change notice from the server would.
 */
export function invalidateBusinessReads(client: QueryClient, businessId: string) {
  return client.invalidateQueries({ predicate: (query) => query.queryKey[1] === businessId });
}

/**
 * A posted, voided or replaced sale changes every history page, the monthly summary and the
 * operating report, not only the records it names.
 */
export function invalidateSaleReads(client: QueryClient, businessId: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: saleQueryKeys.all(businessId) }),
    client.invalidateQueries({ queryKey: reportsQueryKeys.all(businessId) }),
  ]);
}
