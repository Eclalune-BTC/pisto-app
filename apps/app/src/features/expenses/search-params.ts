import {
  calendarLocalDateSchema,
  type ExpenseCategory,
  type ExpenseStatus,
  expenseCategorySchema,
  uuidSchema,
} from "@pisto/contracts";
import { firstParam, type RouteParam } from "@/lib/route-params";

export type ExpenseHistoryFilters = {
  accountId: string | "all";
  category: ExpenseCategory | "all";
  status: ExpenseStatus | "all";
};

export type ExpensePeriod = { endLocalDate: string; startLocalDate: string };

export type ExpenseSearchParams = {
  account?: RouteParam;
  category?: RouteParam;
  end?: RouteParam;
  start?: RouteParam;
  status?: RouteParam;
};

export const defaultExpenseFilters: ExpenseHistoryFilters = {
  accountId: "all",
  category: "all",
  status: "posted",
};

const statuses: readonly (ExpenseStatus | "all")[] = ["posted", "voided", "all"];

export function isValidExpensePeriod(period: ExpensePeriod): boolean {
  return (
    calendarLocalDateSchema.safeParse(period.startLocalDate).success &&
    calendarLocalDateSchema.safeParse(period.endLocalDate).success &&
    period.startLocalDate <= period.endLocalDate
  );
}

/**
 * History filters and the summary period live in the URL so a record opened from the list returns
 * to the same view. A malformed value falls back to that control's default view; the default period
 * is unknown until the business time zone is.
 */
export function parseExpenseSearch(
  params: ExpenseSearchParams,
  defaultPeriod: ExpensePeriod | undefined,
): { filters: ExpenseHistoryFilters; period: ExpensePeriod | undefined } {
  const status = firstParam(params.status);
  const category = expenseCategorySchema.safeParse(firstParam(params.category));
  const account = uuidSchema.safeParse(firstParam(params.account));
  const period = {
    endLocalDate: firstParam(params.end) ?? "",
    startLocalDate: firstParam(params.start) ?? "",
  };
  return {
    filters: {
      accountId: account.success ? account.data : "all",
      category: category.success ? category.data : "all",
      status: statuses.find((candidate) => candidate === status) ?? "posted",
    },
    period: isValidExpensePeriod(period) ? period : defaultPeriod,
  };
}

/** Route parameters for the history filters; default values are left out of the URL. */
export function expenseFilterParams(filters: ExpenseHistoryFilters) {
  return {
    account: filters.accountId === "all" ? undefined : filters.accountId,
    category: filters.category === "all" ? undefined : filters.category,
    status: filters.status === "posted" ? undefined : filters.status,
  };
}

export function expensePeriodParams(period: ExpensePeriod, defaultPeriod: ExpensePeriod) {
  const isDefault =
    period.startLocalDate === defaultPeriod.startLocalDate &&
    period.endLocalDate === defaultPeriod.endLocalDate;
  return {
    end: isDefault ? undefined : period.endLocalDate,
    start: isDefault ? undefined : period.startLocalDate,
  };
}

/** The server filter shape: "all" means the filter is absent. */
export function expenseListFilters(filters: ExpenseHistoryFilters) {
  return {
    ...(filters.accountId === "all" ? {} : { accountId: filters.accountId }),
    ...(filters.category === "all" ? {} : { category: filters.category }),
    status: filters.status,
  };
}
