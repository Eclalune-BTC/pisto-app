import type { CashAccountStatus, ExpenseCategory, ExpenseStatus } from "@pisto/contracts";
import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";

import { cashApi } from "./api";

const pageSize = 25;
const choicePageSize = 50;

export const cashQueryKeys = {
  all: (businessId: string | undefined) => ["cash", businessId] as const,
  accounts: (businessId: string | undefined) =>
    [...cashQueryKeys.all(businessId), "accounts"] as const,
  accountLists: (businessId: string | undefined) =>
    [...cashQueryKeys.accounts(businessId), "list"] as const,
  accountList: (businessId: string | undefined, status: CashAccountStatus | "all") =>
    [...cashQueryKeys.accountLists(businessId), status] as const,
  account: (businessId: string | undefined, accountId: string | undefined) =>
    [...cashQueryKeys.accounts(businessId), "detail", accountId] as const,
  movements: (businessId: string | undefined) =>
    [...cashQueryKeys.all(businessId), "movements"] as const,
  movementList: (businessId: string | undefined, accountId?: string) =>
    [...cashQueryKeys.movements(businessId), "list", accountId ?? "all"] as const,
} as const;

export const expenseQueryKeys = {
  all: (businessId: string | undefined) => ["expenses", businessId] as const,
  lists: (businessId: string | undefined) => [...expenseQueryKeys.all(businessId), "list"] as const,
  list: (
    businessId: string | undefined,
    filters: {
      status: ExpenseStatus | "all";
      category?: ExpenseCategory;
      accountId?: string;
    },
  ) => [...expenseQueryKeys.lists(businessId), filters] as const,
  details: (businessId: string | undefined) =>
    [...expenseQueryKeys.all(businessId), "detail"] as const,
  detail: (businessId: string | undefined, expenseId: string | undefined) =>
    [...expenseQueryKeys.details(businessId), expenseId] as const,
  summaries: (businessId: string | undefined) =>
    [...expenseQueryKeys.all(businessId), "summary"] as const,
  summary: (businessId: string | undefined, startLocalDate: string, endLocalDate: string) =>
    [...expenseQueryKeys.summaries(businessId), startLocalDate, endLocalDate] as const,
} as const;

export function cashAccountsInfiniteOptions(
  businessId: string | undefined,
  status: CashAccountStatus | "all",
  limit = pageSize,
) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          cashApi.accounts.list({ cursor: pageParam, limit, status }, signal)
      : skipToken,
    queryKey: cashQueryKeys.accountList(businessId, status),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function activeCashAccountsInfiniteOptions(businessId: string | undefined) {
  return cashAccountsInfiniteOptions(businessId, "active", choicePageSize);
}

export function cashAccountQueryOptions(
  businessId: string | undefined,
  accountId: string | undefined,
) {
  return queryOptions({
    queryFn:
      businessId && accountId ? ({ signal }) => cashApi.accounts.get(accountId, signal) : skipToken,
    queryKey: cashQueryKeys.account(businessId, accountId),
  });
}

export function cashMovementsInfiniteOptions(businessId: string | undefined, accountId?: string) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          cashApi.movements.list({ accountId, cursor: pageParam, limit: pageSize }, signal)
      : skipToken,
    queryKey: cashQueryKeys.movementList(businessId, accountId),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function expensesInfiniteOptions(
  businessId: string | undefined,
  filters: {
    status: ExpenseStatus | "all";
    category?: ExpenseCategory;
    accountId?: string;
  },
) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          cashApi.expenses.list({ ...filters, cursor: pageParam, limit: pageSize }, signal)
      : skipToken,
    queryKey: expenseQueryKeys.list(businessId, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function expenseQueryOptions(businessId: string | undefined, expenseId: string | undefined) {
  return queryOptions({
    queryFn:
      businessId && expenseId ? ({ signal }) => cashApi.expenses.get(expenseId, signal) : skipToken,
    queryKey: expenseQueryKeys.detail(businessId, expenseId),
  });
}

export function expenseSummaryQueryOptions(
  businessId: string | undefined,
  startLocalDate: string,
  endLocalDate: string,
) {
  return queryOptions({
    queryFn:
      businessId && startLocalDate && endLocalDate
        ? ({ signal }) => cashApi.expenses.summary({ startLocalDate, endLocalDate }, signal)
        : skipToken,
    queryKey: expenseQueryKeys.summary(businessId, startLocalDate, endLocalDate),
  });
}

export function flattenPages<T>(data: { pages: { items: T[] }[] } | undefined): T[] {
  return data?.pages.flatMap(({ items }) => items) ?? [];
}
