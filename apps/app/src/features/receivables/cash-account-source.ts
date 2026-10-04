import {
  type CashAccount,
  type CashAccountListQuery,
  cashAccountDetailResponseSchema,
  cashAccountListQuerySchema,
  cashAccountListResponseSchema,
} from "@pisto/contracts";
import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";
import type { z } from "zod";

import { cashQueryKeys } from "@/features/cash/queries";
import { apiRequest, parseRequestPayload, pathWithQuery } from "@/lib/api-client";

type CashAccountListResponse = z.infer<typeof cashAccountListResponseSchema>;
type CashAccountDetailResponse = z.infer<typeof cashAccountDetailResponseSchema>;

export type CashAccountChoice = Pick<CashAccount, "id" | "name" | "status">;

// Nested under the cash accounts key so that every cash-ledger invalidation also refreshes the
// accounts a payment may be recorded into.
export const receivableCashAccountKeys = {
  all: (businessId: string | undefined) =>
    [...cashQueryKeys.accounts(businessId), "receivable-account-choice"] as const,
  detail: (businessId: string | undefined, accountId: string | undefined) =>
    [...receivableCashAccountKeys.all(businessId), "detail", accountId] as const,
  list: (businessId: string | undefined, status: "active" | "all") =>
    [...receivableCashAccountKeys.all(businessId), "list", status] as const,
};

const CHOICE_PAGE_SIZE = 50;

export const receivableCashAccountSource = {
  list: (query: CashAccountListQuery, signal?: AbortSignal) =>
    apiRequest<CashAccountListResponse, CashAccountListResponse["data"]>(
      pathWithQuery("/v1/cash/accounts", parseRequestPayload(cashAccountListQuerySchema, query)),
      { authenticated: true, signal },
      cashAccountListResponseSchema,
    ),
  get: (accountId: string, signal?: AbortSignal) =>
    apiRequest<CashAccountDetailResponse, CashAccountDetailResponse["data"]>(
      `/v1/cash/accounts/${encodeURIComponent(accountId)}`,
      { authenticated: true, signal },
      cashAccountDetailResponseSchema,
    ),
} as const;

export function cashAccountDetailQueryOptions(
  businessId: string | undefined,
  accountId: string | undefined,
) {
  return queryOptions({
    queryKey: receivableCashAccountKeys.detail(businessId, accountId),
    queryFn:
      businessId && accountId
        ? ({ signal }) => receivableCashAccountSource.get(accountId, signal)
        : skipToken,
  });
}

export function cashAccountChoicesQueryOptions(
  businessId: string | undefined,
  status: "active" | "all" = "active",
) {
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: receivableCashAccountKeys.list(businessId, status),
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          receivableCashAccountSource.list(
            { cursor: pageParam ?? undefined, limit: CHOICE_PAGE_SIZE, status },
            signal,
          )
      : skipToken,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
