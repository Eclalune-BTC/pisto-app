import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { isValidCashLocalDate } from "../cash/drafts";
import {
  cashAccountsInfiniteOptions,
  expenseSummaryQueryOptions,
  expensesInfiniteOptions,
  flattenPages,
} from "../cash/queries";
import { featureRemoteState, queryHasStaleData } from "../cash/remote-state";
import { useCashAccess } from "../cash/use-cash-access";
import { expenseCategoryOptions, expensesOverviewCopy, expensesUiCopy } from "./copy";
import type { ExpenseFiltersValue, ExpensePeriodValue } from "./expense-filters";
import { ExpensesScreen, type ExpensesScreenState } from "./expenses-screen";

function currentMonthPeriod(timeZone: string): ExpensePeriodValue {
  const endLocalDate = currentLocalDateTime(timeZone).date;
  return { endLocalDate, startLocalDate: `${endLocalDate.slice(0, 7)}-01` };
}

export function ExpensesController() {
  const router = useRouter();
  const {
    business,
    businesses,
    canManage,
    canRead,
    isStale: accessIsStale,
  } = useCashAccess("expenses");
  const [filters, setFilters] = useState<ExpenseFiltersValue>({
    accountId: "all",
    category: "all",
    status: "posted",
  });
  const [period, setPeriod] = useState<ExpensePeriodValue>({
    endLocalDate: "",
    startLocalDate: "",
  });
  const [appliedPeriod, setAppliedPeriod] = useState<ExpensePeriodValue>({
    endLocalDate: "",
    startLocalDate: "",
  });
  const [periodError, setPeriodError] = useState<string>();

  useEffect(() => {
    if (!business) return;
    const initialPeriod = currentMonthPeriod(business.timeZone);
    setPeriod(initialPeriod);
    setAppliedPeriod(initialPeriod);
    setPeriodError(undefined);
  }, [business]);

  const normalizedFilters = useMemo(
    () => ({
      ...(filters.accountId === "all" ? {} : { accountId: filters.accountId }),
      ...(filters.category === "all" ? {} : { category: filters.category }),
      status: filters.status,
    }),
    [filters],
  );
  const businessId = business?.id ?? "unselected";
  const expenses = useInfiniteQuery({
    ...expensesInfiniteOptions(businessId, normalizedFilters),
    enabled: Boolean(business && canRead),
  });
  const accounts = useInfiniteQuery({
    ...cashAccountsInfiniteOptions(businessId, "all", 50),
    enabled: Boolean(business && canRead),
  });
  const summary = useQuery({
    ...expenseSummaryQueryOptions(
      businessId,
      appliedPeriod.startLocalDate || "0000-00-00",
      appliedPeriod.endLocalDate || "0000-00-00",
    ),
    enabled: Boolean(
      business && canRead && appliedPeriod.startLocalDate && appliedPeriod.endLocalDate,
    ),
  });

  if (businesses.data && !business) return <Redirect href="/business" />;

  const remoteState = featureRemoteState({
    businessPending: businesses.isPending,
    canRead,
    offlineMessage: expensesUiCopy.offline,
    queries: [businesses, ...(canRead ? [expenses, accounts, summary] : [])],
    unavailableMessage: expensesUiCopy.unavailable,
  });
  const stale =
    accessIsStale ||
    queryHasStaleData(expenses) ||
    queryHasStaleData(accounts) ||
    queryHasStaleData(summary);
  const expenseItems = flattenPages(expenses.data);
  const accountItems = flattenPages(accounts.data);
  const screenState: ExpensesScreenState =
    remoteState.kind !== "ready"
      ? remoteState
      : summary.data
        ? {
            canManage: canManage && !stale,
            confirmation: "idle",
            expenses: expenseItems,
            isStale: stale,
            kind: "ready",
            summary: summary.data.summary,
          }
        : { kind: "loading" };
  const locale = DEFAULT_LOCALE;

  const applyPeriod = () => {
    if (
      !isValidCashLocalDate(period.startLocalDate) ||
      !isValidCashLocalDate(period.endLocalDate) ||
      period.startLocalDate > period.endLocalDate
    ) {
      setPeriodError(expensesUiCopy.invalidPeriod);
      return;
    }
    setPeriodError(undefined);
    setAppliedPeriod(period);
  };

  const retry = () => {
    void Promise.all([
      businesses.refetch(),
      expenses.refetch(),
      accounts.refetch(),
      summary.refetch(),
    ]);
  };

  return (
    <ExpensesScreen
      accounts={accountItems}
      categoryOptions={expenseCategoryOptions}
      copy={expensesOverviewCopy(business?.name ?? "este negocio")}
      filters={filters}
      formatMoney={(minorUnits, currency, fractionDigits) =>
        formatMinorUnits(minorUnits, currency, fractionDigits, locale)
      }
      hasMoreAccounts={Boolean(accounts.hasNextPage)}
      hasMoreExpenses={Boolean(expenses.hasNextPage)}
      isLoadingMoreAccounts={accounts.isFetchingNextPage}
      isLoadingMoreExpenses={expenses.isFetchingNextPage}
      onApplyPeriod={applyPeriod}
      onCheckMutationStatus={retry}
      onFiltersChange={setFilters}
      onLoadMoreAccounts={() => void accounts.fetchNextPage()}
      onLoadMoreExpenses={() => void expenses.fetchNextPage()}
      onOpenExpense={(expenseId) =>
        router.push({ pathname: "/operate/expenses/[expenseId]", params: { expenseId } })
      }
      onPeriodChange={setPeriod}
      onRegisterExpense={() => router.push("/operate/expenses/new")}
      onRetry={retry}
      onVoidExpense={(expenseId) =>
        router.push({
          pathname: "/operate/expenses/[expenseId]",
          params: { action: "void", expenseId },
        })
      }
      period={period}
      periodError={periodError}
      state={screenState}
    />
  );
}
