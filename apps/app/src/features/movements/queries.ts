import type { MoneyTrendRange, MovementListQuery } from "@pisto/contracts";
import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";

import { movementsApi } from "./api";

export const MOVEMENTS_PAGE_SIZE = 25;

export type MovementFilters = Omit<MovementListQuery, "cursor" | "limit">;

/** Keys start with the area and business so the realtime refresh reaches them. */
export const movementQueryKeys = {
  all: (businessId: string | undefined) => ["movements", businessId] as const,
  list: (businessId: string | undefined, filters: MovementFilters | undefined) =>
    [...movementQueryKeys.all(businessId), "list", filters] as const,
  moneyTrend: (businessId: string | undefined, range: MoneyTrendRange) =>
    [...movementQueryKeys.all(businessId), "money-trend", range] as const,
  debtors: (businessId: string | undefined) =>
    [...movementQueryKeys.all(businessId), "debtors"] as const,
} as const;

export function movementsInfiniteOptions(
  businessId: string | undefined,
  filters: MovementFilters | undefined,
  limit = MOVEMENTS_PAGE_SIZE,
) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryKey: [...movementQueryKeys.list(businessId, filters), limit] as const,
    queryFn:
      businessId && filters
        ? ({ pageParam, signal }) =>
            movementsApi.list({ ...filters, cursor: pageParam, limit }, signal)
        : skipToken,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function moneyTrendQueryOptions(businessId: string | undefined, range: MoneyTrendRange) {
  return queryOptions({
    queryKey: movementQueryKeys.moneyTrend(businessId, range),
    queryFn: businessId ? ({ signal }) => movementsApi.moneyTrend(range, signal) : skipToken,
  });
}

export function debtorsQueryOptions(businessId: string | undefined) {
  return queryOptions({
    queryKey: movementQueryKeys.debtors(businessId),
    queryFn: businessId ? ({ signal }) => movementsApi.debtors(signal) : skipToken,
  });
}
