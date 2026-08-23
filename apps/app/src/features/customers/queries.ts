import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { customersApi } from "./api";

export type CustomerListFilters = {
  query?: string;
  status: "active" | "archived" | "all";
};

export const customerQueryKeys = {
  all: (businessId: string) => ["customers", businessId] as const,
  detail: (businessId: string, customerId: string) =>
    [...customerQueryKeys.all(businessId), "detail", customerId] as const,
  lists: (businessId: string) => [...customerQueryKeys.all(businessId), "list"] as const,
  list: (businessId: string, filters: CustomerListFilters) =>
    [...customerQueryKeys.lists(businessId), filters] as const,
};

export function customersQueryOptions(businessId: string, filters: CustomerListFilters) {
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: customerQueryKeys.list(businessId, filters),
    queryFn: ({ pageParam }) =>
      customersApi.list({
        cursor: pageParam ?? undefined,
        limit: 25,
        query: filters.query || undefined,
        status: filters.status,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function customerDetailQueryOptions(businessId: string, customerId: string) {
  return queryOptions({
    queryKey: customerQueryKeys.detail(businessId, customerId),
    queryFn: () => customersApi.get(customerId),
  });
}
