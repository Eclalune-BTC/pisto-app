import type { CashAccount, Expense, ExpensePeriodSummary } from "@pisto/contracts";
import { Link } from "expo-router";
import { Plus, ReceiptText } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { FeatureBoundary, type FeatureRemoteState } from "@/components/feature-boundary";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { type CursorPage, LoadMoreButton } from "../cash/load-more-button";
import { expensesBoundaryCopy } from "./copy";
import { ExpenseFilters } from "./expense-filters";
import { ExpenseHistory } from "./expense-history";
import { ExpenseSummary, ExpenseSummarySkeleton } from "./expense-summary";
import type { ExpenseHistoryFilters, ExpensePeriod } from "./search-params";

type ExpensesScreenProps = {
  /** Names already loaded on this page, keyed by account. */
  accountNames: ReadonlyMap<string, string>;
  accounts: CashAccount[];
  accountsPage: CursorPage;
  businessId: string;
  /** Registering and voiding need expense and cash management on fresh data. */
  canManage: boolean;
  expenses: Expense[];
  expensesPage: CursorPage;
  filters: ExpenseHistoryFilters;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  formatOccurredAt: (expense: Expense) => string;
  historyState: FeatureRemoteState;
  isStale: boolean;
  onApplyPeriod: () => void;
  onFiltersChange: (next: ExpenseHistoryFilters) => void;
  onPeriodChange: (next: ExpensePeriod) => void;
  onRetry: () => void;
  onVoidExpense: (expense: Expense) => void;
  /** The dates shown in the range control, applied or not. */
  period: ExpensePeriod;
  periodError?: string;
  summary: ExpensePeriodSummary | undefined;
  summaryState: FeatureRemoteState;
};

export function ExpensesScreen({
  accountNames,
  accounts,
  accountsPage,
  businessId,
  canManage,
  expenses,
  expensesPage,
  filters,
  formatMoney,
  formatOccurredAt,
  historyState,
  isStale,
  onApplyPeriod,
  onFiltersChange,
  onPeriodChange,
  onRetry,
  onVoidExpense,
  period,
  periodError,
  summary,
  summaryState,
}: ExpensesScreenProps) {
  const { t } = useTranslation();
  const boundary = expensesBoundaryCopy(t);
  const register = (size?: "sm") => (
    <Link asChild href="/operate/expenses/new">
      <Button accessibilityRole="link" size={size}>
        {size ? null : <Icon as={Plus} className="text-primary-foreground" size={16} />}
        <Text>{t("expenses.overview.register")}</Text>
      </Button>
    </Link>
  );
  return (
    <Page>
      <PageHeader
        actions={canManage ? register() : undefined}
        description={t("expenses.overview.description")}
        title={t("expenses.overview.title")}
      />

      {isStale ? <StaleNotice onRetry={onRetry} /> : null}

      <Section description={t("expenses.summary.scope")} title={t("filters.periodSummary")}>
        <View className="min-w-0 max-w-xl">
          <DateRangeFilter
            applyLabel={t("expenses.summary.apply")}
            endDate={period.endLocalDate}
            endLabel={t("expenses.summary.endDate")}
            error={periodError}
            onApply={onApplyPeriod}
            onEndDateChange={(endLocalDate) => onPeriodChange({ ...period, endLocalDate })}
            onStartDateChange={(startLocalDate) => onPeriodChange({ ...period, startLocalDate })}
            startDate={period.startLocalDate}
            startLabel={t("expenses.summary.startDate")}
          />
        </View>
        {summaryState.kind === "loading" ? (
          <ExpenseSummarySkeleton />
        ) : (
          <FeatureBoundary
            copy={{ ...boundary, unavailableTitle: t("expenses.summary.unavailable") }}
            inline
            onRetry={onRetry}
            state={summaryState}
          >
            {summary ? <ExpenseSummary summary={summary} /> : null}
          </FeatureBoundary>
        )}
      </Section>

      <Section title={t("filters.history")}>
        <ExpenseFilters
          accounts={accounts}
          accountsPage={accountsPage}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
        <FeatureBoundary
          copy={{ ...boundary, unavailableTitle: t("expenses.overview.historyUnavailable") }}
          inline
          onRetry={onRetry}
          state={historyState}
        >
          <View className="min-w-0 gap-3">
            <ExpenseHistory
              accountNames={accountNames}
              businessId={businessId}
              empty={
                <EmptyState
                  action={canManage ? register("sm") : undefined}
                  description={t("expenses.overview.emptyDescription")}
                  icon={ReceiptText}
                  title={t("expenses.overview.emptyTitle")}
                />
              }
              expenses={expenses}
              formatMoney={formatMoney}
              formatOccurredAt={formatOccurredAt}
              onVoidExpense={canManage ? onVoidExpense : undefined}
            />
            <LoadMoreButton page={expensesPage} />
          </View>
        </FeatureBoundary>
      </Section>
    </Page>
  );
}
