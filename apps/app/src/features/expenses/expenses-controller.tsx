import type { Expense } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FeatureBoundary } from "@/components/feature-boundary";
import { formatLocalizedDateTime } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { currentLocalDateTime, formatMinorUnits } from "@/lib/money";
import { hasDeniedRead, queryHasStaleData } from "@/lib/query-state";
import {
  cashAccountsInfiniteOptions,
  expenseSummaryQueryOptions,
  expensesInfiniteOptions,
  flattenPages,
} from "../cash/queries";
import { featureRemoteState } from "../cash/remote-state";
import { useCashAccess } from "../cash/use-cash-access";
import { expensesBoundaryCopy } from "./copy";
import { ExpenseVoidDialog } from "./expense-void-dialog";
import { ExpensesScreen } from "./expenses-screen";
import {
  type ExpensePeriod,
  type ExpenseSearchParams,
  expenseFilterParams,
  expenseListFilters,
  expensePeriodParams,
  isValidExpensePeriod,
  parseExpenseSearch,
} from "./search-params";

/** The current business month up to today, in the business time zone. */
export function currentMonthPeriod(timeZone: string): ExpensePeriod {
  const today = currentLocalDateTime(timeZone).date;
  return { endLocalDate: today, startLocalDate: `${today.slice(0, 7)}-01` };
}

export function ExpensesController() {
  const router = useRouter();
  const params = useLocalSearchParams<ExpenseSearchParams>();
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const access = useCashAccess("expenses");
  const { business, businesses, canRead } = access;
  const businessId = canRead ? business?.id : undefined;
  const defaultPeriod = business ? currentMonthPeriod(business.timeZone) : undefined;
  const { filters, period } = parseExpenseSearch(params, defaultPeriod);
  const [draftPeriod, setDraftPeriod] = useState<ExpensePeriod>();
  const [periodError, setPeriodError] = useState<string>();
  const [voiding, setVoiding] = useState<{ businessId: string; expense: Expense }>();
  const expenses = useInfiniteQuery(
    expensesInfiniteOptions(businessId, expenseListFilters(filters)),
  );
  const accounts = useInfiniteQuery(cashAccountsInfiniteOptions(businessId, "all", 50));
  const summary = useQuery(
    expenseSummaryQueryOptions(
      businessId,
      period?.startLocalDate ?? "",
      period?.endLocalDate ?? "",
    ),
  );

  if (businesses.data && !business) return <Redirect href="/business" />;

  const messages = {
    offlineMessage: t("remote.offlineLoad"),
    unavailableMessage: t("expenses.remote.unavailable"),
  };
  const retry = () => {
    void Promise.all([
      businesses.refetch(),
      expenses.refetch(),
      accounts.refetch(),
      summary.refetch(),
    ]);
  };
  const pageState = hasDeniedRead([expenses, accounts, summary])
    ? ({ kind: "denied" } as const)
    : featureRemoteState({
        ...messages,
        businessPending: businesses.isPending,
        canRead,
        queries: [businesses],
      });
  if (pageState.kind !== "ready") {
    return (
      <FeatureBoundary copy={expensesBoundaryCopy(t)} onRetry={retry} state={pageState}>
        {null}
      </FeatureBoundary>
    );
  }
  if (!business || !defaultPeriod || !period) {
    throw new Error("A readable expense page requires the active business");
  }

  // Each section reports its own read, so a slow summary never holds back the history.
  const sectionState = (query: typeof expenses | typeof summary) =>
    featureRemoteState({ ...messages, businessPending: false, canRead: true, queries: [query] });
  const stale =
    access.isStale ||
    queryHasStaleData(expenses) ||
    queryHasStaleData(accounts) ||
    queryHasStaleData(summary);
  const canManage =
    access.canManage && business.access.permissions.includes("cash:manage") && !stale;
  const accountItems = flattenPages(accounts.data);
  const voidTarget = voiding?.businessId === business.id ? voiding.expense : undefined;

  return (
    <>
      <ExpensesScreen
        accountNames={new Map(accountItems.map(({ id, name }) => [id, name]))}
        accounts={accountItems}
        accountsPage={{
          hasMore: accounts.hasNextPage,
          loadingMore: accounts.isFetchingNextPage,
          onLoadMore: () => void accounts.fetchNextPage(),
        }}
        businessId={business.id}
        canManage={canManage}
        expenses={flattenPages(expenses.data)}
        expensesPage={{
          hasMore: expenses.hasNextPage,
          loadingMore: expenses.isFetchingNextPage,
          onLoadMore: () => void expenses.fetchNextPage(),
        }}
        filters={filters}
        formatMoney={(minorUnits, currency, fractionDigits) =>
          formatMinorUnits(minorUnits, currency, fractionDigits, locale)
        }
        formatOccurredAt={(expense) =>
          formatLocalizedDateTime(expense.occurredAt, locale, expense.timeZone)
        }
        historyState={sectionState(expenses)}
        isStale={stale}
        onApplyPeriod={() => {
          const next = draftPeriod ?? period;
          if (!isValidExpensePeriod(next)) {
            setPeriodError(t("expenses.remote.invalidPeriod"));
            return;
          }
          setPeriodError(undefined);
          setDraftPeriod(undefined);
          router.setParams(expensePeriodParams(next, defaultPeriod));
        }}
        onFiltersChange={(next) => router.setParams(expenseFilterParams(next))}
        onPeriodChange={setDraftPeriod}
        onRetry={retry}
        onVoidExpense={(expense) => setVoiding({ businessId: business.id, expense })}
        period={draftPeriod ?? period}
        periodError={periodError}
        summary={summary.data?.summary}
        summaryState={sectionState(summary)}
      />
      {voidTarget ? (
        <ExpenseVoidDialog
          businessId={business.id}
          canConfirm={canManage}
          expense={voidTarget}
          key={voidTarget.id}
          linkToRecord
          onClose={() => setVoiding(undefined)}
          timeZone={business.timeZone}
        />
      ) : null}
    </>
  );
}
