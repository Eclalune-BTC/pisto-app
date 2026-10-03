import type { CashAccount, ExpenseCategory } from "@pisto/contracts";
import { AlertTriangle } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";
import { WorkspaceTabs } from "@/components/ui/workspace-tabs";
import { FeatureBoundary } from "../cash/feature-boundary";
import {
  ExpenseFilters,
  type ExpenseFiltersCopy,
  type ExpenseFiltersValue,
  type ExpensePeriodValue,
} from "./expense-filters";
import { ExpenseHistory } from "./expense-history";
import { ExpenseSummary } from "./expense-summary";
import { type ExpensesScreenState, expensesScreenPresentation } from "./state";

export type { ExpensesScreenState } from "./state";

export type ExpensesScreenCopy = ExpenseFiltersCopy & {
  title: string;
  description: string;
  eyebrow: string;
  loading: string;
  retry: string;
  deniedTitle: string;
  offlineTitle: string;
  deniedDescription: string;
  unavailableTitle: string;
  registerExpense: string;
  emptyTitle: string;
  emptyDescription: string;
  periodTotal: string;
  recordedExpenses: string;
  categoryBreakdown: string;
  historyTitle: string;
  expensesNotProfit: string;
  posted: string;
  voided: string;
  voidAction: string;
  mutationFailedTitle: string;
  uncertainTitle: string;
  uncertainDescription: string;
  retrySameConfirmation: string;
  loadMore: string;
  loadingMore: string;
  noCategoryData: string;
  categories: Record<ExpenseCategory, string>;
};

type ExpensesScreenProps = {
  state: ExpensesScreenState;
  accounts: CashAccount[];
  filters: ExpenseFiltersValue;
  hasMoreAccounts: boolean;
  hasMoreExpenses: boolean;
  isLoadingMoreAccounts: boolean;
  isLoadingMoreExpenses: boolean;
  period: ExpensePeriodValue;
  periodError?: string;
  copy: ExpensesScreenCopy;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onRegisterExpense: () => void;
  onOpenExpense: (expenseId: string) => void;
  onVoidExpense: (expenseId: string) => void;
  onRetry: () => void;
  onCheckMutationStatus: () => void;
  onApplyPeriod: () => void;
  onFiltersChange: (next: ExpenseFiltersValue) => void;
  onLoadMoreAccounts: () => void;
  onLoadMoreExpenses: () => void;
  onPeriodChange: (next: ExpensePeriodValue) => void;
  categoryOptions: readonly { label: string; value: ExpenseCategory }[];
};

export function ExpensesScreen({
  state,
  accounts,
  filters,
  hasMoreAccounts,
  hasMoreExpenses,
  isLoadingMoreAccounts,
  isLoadingMoreExpenses,
  period,
  periodError,
  copy,
  formatMoney,
  onRegisterExpense,
  onOpenExpense,
  onVoidExpense,
  onRetry,
  onCheckMutationStatus,
  onApplyPeriod,
  onFiltersChange,
  onLoadMoreAccounts,
  onLoadMoreExpenses,
  onPeriodChange,
  categoryOptions,
}: ExpensesScreenProps) {
  const presentation = expensesScreenPresentation(state);
  const { t } = useTranslation();
  const [view, setView] = useState<"history" | "summary">("history");
  return (
    <Page contentContainerClassName="gap-6">
      <ScreenHeader
        action={
          presentation.showCreate ? (
            <Button label={copy.registerExpense} onPress={onRegisterExpense} variant="default" />
          ) : undefined
        }
        description={state.kind === "denied" ? copy.deniedDescription : copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />
      {state.kind === "ready" && state.isStale ? <StaleNotice /> : null}
      {state.kind === "ready" && state.confirmation === "uncertain" ? (
        <Alert icon={AlertTriangle}>
          <AlertTitle className="leading-6">{copy.uncertainTitle}</AlertTitle>
          <AlertDescription>{copy.uncertainDescription}</AlertDescription>
          <Button
            className="mb-2 ml-6 mt-2 self-start"
            label={copy.retrySameConfirmation}
            onPress={onCheckMutationStatus}
            variant="outline"
          />
        </Alert>
      ) : state.kind === "ready" && state.confirmation === "failed" ? (
        <Alert icon={AlertTriangle} variant="destructive">
          <AlertTitle className="leading-6">{copy.mutationFailedTitle}</AlertTitle>
          {state.mutationMessage ? (
            <AlertDescription>{state.mutationMessage}</AlertDescription>
          ) : null}
          <Button
            className="mb-2 ml-6 mt-2 self-start"
            label={copy.retry}
            onPress={onRetry}
            variant="outline"
          />
        </Alert>
      ) : null}
      {state.kind === "denied" ? (
        <FeatureBoundary copy={copy} inline onRetry={onRetry} state={state}>
          {null}
        </FeatureBoundary>
      ) : (
        <WorkspaceTabs
          label={t("filters.views")}
          onChange={setView}
          value={view}
          items={[
            {
              value: "history",
              label: t("filters.history"),
              content: (
                <>
                  <ExpenseFilters
                    accounts={accounts}
                    categoryOptions={categoryOptions}
                    copy={copy}
                    filters={filters}
                    hasMoreAccounts={hasMoreAccounts}
                    isLoadingMoreAccounts={isLoadingMoreAccounts}
                    onFiltersChange={onFiltersChange}
                    onLoadMoreAccounts={onLoadMoreAccounts}
                  />
                  <FeatureBoundary copy={copy} inline onRetry={onRetry} state={state}>
                    {state.kind === "ready" ? (
                      <View className="min-w-0 gap-4">
                        {state.expenses.length === 0 ? (
                          <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
                        ) : (
                          <ExpenseHistory
                            canManage={state.canManage}
                            categoryLabels={copy.categories}
                            expenses={state.expenses}
                            formatMoney={formatMoney}
                            onOpenExpense={onOpenExpense}
                            onVoidExpense={onVoidExpense}
                            postedLabel={copy.posted}
                            voidActionLabel={copy.voidAction}
                            voidedLabel={copy.voided}
                          />
                        )}
                        {hasMoreExpenses ? (
                          <Button
                            className="self-start"
                            label={isLoadingMoreExpenses ? copy.loadingMore : copy.loadMore}
                            loading={isLoadingMoreExpenses}
                            onPress={onLoadMoreExpenses}
                            variant="outline"
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </FeatureBoundary>
                </>
              ),
            },
            {
              value: "summary",
              label: t("filters.periodSummary"),
              content: (
                <>
                  <View className="min-w-0 gap-3">
                    <DateRangeFilter
                      applyLabel={copy.applyPeriod}
                      endDate={period.endLocalDate}
                      endLabel={copy.endDate}
                      error={periodError}
                      onApply={onApplyPeriod}
                      onEndDateChange={(endLocalDate) =>
                        onPeriodChange({ ...period, endLocalDate })
                      }
                      onStartDateChange={(startLocalDate) =>
                        onPeriodChange({ ...period, startLocalDate })
                      }
                      startDate={period.startLocalDate}
                      startLabel={copy.startDate}
                    />
                    <Text className="font-sans text-sm leading-6 text-muted-foreground">
                      {copy.periodScope}
                    </Text>
                  </View>
                  <FeatureBoundary copy={copy} inline onRetry={onRetry} state={state}>
                    {state.kind === "ready" ? (
                      <ExpenseSummary
                        categoryBreakdownLabel={copy.categoryBreakdown}
                        categoryLabels={copy.categories}
                        expensesNotProfit={copy.expensesNotProfit}
                        formatMoney={formatMoney}
                        periodTotalLabel={copy.periodTotal}
                        recordedExpensesLabel={copy.recordedExpenses}
                        noCategoryData={copy.noCategoryData}
                        summary={state.summary}
                      />
                    ) : null}
                  </FeatureBoundary>
                </>
              ),
            },
          ]}
        />
      )}
    </Page>
  );
}
