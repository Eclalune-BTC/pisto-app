import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";

import { customersApi } from "./api";

export type CustomerListFilters = {
  query?: string;
  status: "active" | "archived" | "all";
};

export const customerQueryKeys = {
  all: (businessId: string | undefined) => ["customers", businessId] as const,
  detail: (businessId: string | undefined, customerId: string | undefined) =>
    [...customerQueryKeys.all(businessId), "detail", customerId] as const,
  lists: (businessId: string | undefined) =>
    [...customerQueryKeys.all(businessId), "list"] as const,
  list: (businessId: string | undefined, filters: CustomerListFilters) =>
    [...customerQueryKeys.lists(businessId), filters] as const,
};

export function customersQueryOptions(
  businessId: string | undefined,
  filters: CustomerListFilters,
) {
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: customerQueryKeys.list(businessId, filters),
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          customersApi.list(
            {
              cursor: pageParam ?? undefined,
              limit: 25,
              query: filters.query || undefined,
              status: filters.status,
            },
            signal,
          )
      : skipToken,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function customerDetailQueryOptions(
  businessId: string | undefined,
  customerId: string | undefined,
) {
  return queryOptions({
    queryKey: customerQueryKeys.detail(businessId, customerId),
    queryFn:
      businessId && customerId ? ({ signal }) => customersApi.get(customerId, signal) : skipToken,
  });
}
