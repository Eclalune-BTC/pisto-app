import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";

import { receivablesApi } from "./api";

export type ReceivableListFilters = {
  customerId?: string;
  state: "all" | "open" | "overdue" | "paid" | "voided";
};

export const receivableQueryKeys = {
  all: (businessId: string | undefined) => ["receivables", businessId] as const,
  detail: (businessId: string | undefined, receivableId: string | undefined) =>
    [...receivableQueryKeys.all(businessId), "detail", receivableId] as const,
  lists: (businessId: string | undefined) =>
    [...receivableQueryKeys.all(businessId), "list"] as const,
  list: (businessId: string | undefined, filters: ReceivableListFilters | undefined) =>
    [...receivableQueryKeys.lists(businessId), filters] as const,
  summary: (businessId: string | undefined) =>
    [...receivableQueryKeys.all(businessId), "summary"] as const,
};

export function receivablesQueryOptions(
  businessId: string | undefined,
  filters: ReceivableListFilters | undefined,
) {
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: receivableQueryKeys.list(businessId, filters),
    queryFn:
      businessId && filters
        ? ({ pageParam, signal }) =>
            receivablesApi.list(
              {
                cursor: pageParam ?? undefined,
                customerId: filters.customerId,
                limit: 25,
                state: filters.state,
              },
              signal,
            )
        : skipToken,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function receivableDetailQueryOptions(
  businessId: string | undefined,
  receivableId: string | undefined,
) {
  return queryOptions({
    queryKey: receivableQueryKeys.detail(businessId, receivableId),
    queryFn:
      businessId && receivableId
        ? ({ signal }) => receivablesApi.get(receivableId, signal)
        : skipToken,
  });
}

export function receivablesSummaryQueryOptions(businessId: string | undefined) {
  return queryOptions({
    queryKey: receivableQueryKeys.summary(businessId),
    queryFn: businessId ? ({ signal }) => receivablesApi.summary(signal) : skipToken,
  });
}
