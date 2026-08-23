import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import type {
  CashAccountStatus,
  ExpenseCategory,
  ExpenseStatus,
} from "../../../../../packages/contracts/src/cash.ts";

import { cashApi } from "./api";

const pageSize = 25;
const choicePageSize = 50;

export const cashQueryKeys = {
  all: (businessId: string) => ["cash", businessId] as const,
  accounts: (businessId: string) => [...cashQueryKeys.all(businessId), "accounts"] as const,
  accountLists: (businessId: string) => [...cashQueryKeys.accounts(businessId), "list"] as const,
  accountList: (businessId: string, status: CashAccountStatus | "all") =>
    [...cashQueryKeys.accountLists(businessId), status] as const,
  account: (businessId: string, accountId: string) =>
    [...cashQueryKeys.accounts(businessId), "detail", accountId] as const,
  movements: (businessId: string) => [...cashQueryKeys.all(businessId), "movements"] as const,
  movementList: (businessId: string, accountId?: string) =>
    [...cashQueryKeys.movements(businessId), "list", accountId ?? "all"] as const,
} as const;

export const expenseQueryKeys = {
  all: (businessId: string) => ["expenses", businessId] as const,
  lists: (businessId: string) => [...expenseQueryKeys.all(businessId), "list"] as const,
  list: (
    businessId: string,
    filters: {
      status: ExpenseStatus | "all";
      category?: ExpenseCategory;
      accountId?: string;
    },
  ) => [...expenseQueryKeys.lists(businessId), filters] as const,
  details: (businessId: string) => [...expenseQueryKeys.all(businessId), "detail"] as const,
  detail: (businessId: string, expenseId: string) =>
    [...expenseQueryKeys.details(businessId), expenseId] as const,
  summaries: (businessId: string) => [...expenseQueryKeys.all(businessId), "summary"] as const,
  summary: (businessId: string, startLocalDate: string, endLocalDate: string) =>
    [...expenseQueryKeys.summaries(businessId), startLocalDate, endLocalDate] as const,
} as const;

export function cashAccountsInfiniteOptions(
  businessId: string,
  status: CashAccountStatus | "all",
  limit = pageSize,
) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => cashApi.accounts.list({ cursor: pageParam, limit, status }),
    queryKey: cashQueryKeys.accountList(businessId, status),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function activeCashAccountsInfiniteOptions(businessId: string) {
  return cashAccountsInfiniteOptions(businessId, "active", choicePageSize);
}

export function cashAccountQueryOptions(businessId: string, accountId: string) {
  return queryOptions({
    queryFn: () => cashApi.accounts.get(accountId),
    queryKey: cashQueryKeys.account(businessId, accountId),
  });
}

export function cashMovementsInfiniteOptions(businessId: string, accountId?: string) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      cashApi.movements.list({ accountId, cursor: pageParam, limit: pageSize }),
    queryKey: cashQueryKeys.movementList(businessId, accountId),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function expensesInfiniteOptions(
  businessId: string,
  filters: {
    status: ExpenseStatus | "all";
    category?: ExpenseCategory;
    accountId?: string;
  },
) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      cashApi.expenses.list({ ...filters, cursor: pageParam, limit: pageSize }),
    queryKey: expenseQueryKeys.list(businessId, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

export function expenseQueryOptions(businessId: string, expenseId: string) {
  return queryOptions({
    queryFn: () => cashApi.expenses.get(expenseId),
    queryKey: expenseQueryKeys.detail(businessId, expenseId),
  });
}

export function expenseSummaryQueryOptions(
  businessId: string,
  startLocalDate: string,
  endLocalDate: string,
) {
  return queryOptions({
    queryFn: () => cashApi.expenses.summary({ startLocalDate, endLocalDate }),
    queryKey: expenseQueryKeys.summary(businessId, startLocalDate, endLocalDate),
  });
}

export function flattenPages<T>(data: { pages: { items: T[] }[] } | undefined): T[] {
  return data?.pages.flatMap(({ items }) => items) ?? [];
}
