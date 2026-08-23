import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import { receivablesApi } from "./api";

export type ReceivableListFilters = {
  customerId?: string;
  state: "all" | "open" | "overdue" | "paid" | "voided";
};

export const receivableQueryKeys = {
  all: (businessId: string) => ["receivables", businessId] as const,
  detail: (businessId: string, receivableId: string) =>
    [...receivableQueryKeys.all(businessId), "detail", receivableId] as const,
  lists: (businessId: string) => [...receivableQueryKeys.all(businessId), "list"] as const,
  list: (businessId: string, filters: ReceivableListFilters) =>
    [...receivableQueryKeys.lists(businessId), filters] as const,
  summary: (businessId: string) => [...receivableQueryKeys.all(businessId), "summary"] as const,
};

export function receivablesQueryOptions(businessId: string, filters: ReceivableListFilters) {
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: receivableQueryKeys.list(businessId, filters),
    queryFn: ({ pageParam }) =>
      receivablesApi.list({
        cursor: pageParam ?? undefined,
        customerId: filters.customerId,
        limit: 25,
        state: filters.state,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function receivableDetailQueryOptions(businessId: string, receivableId: string) {
  return queryOptions({
    queryKey: receivableQueryKeys.detail(businessId, receivableId),
    queryFn: () => receivablesApi.get(receivableId),
  });
}

export function receivablesSummaryQueryOptions(businessId: string) {
  return queryOptions({
    queryKey: receivableQueryKeys.summary(businessId),
    queryFn: receivablesApi.summary,
  });
}
