import type { CashAccount, ExpenseCategory } from "@pisto/contracts";
import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Page } from "@/components/page";
import { StaleNotice } from "@/components/remote-state";
import { ScreenHeader } from "@/components/screen-header";
import { Button } from "@/components/ui/button";
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
  checkStatus: string;
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

function MessageState({
  description,
  title,
  action,
}: {
  description: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
      <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
        {title}
      </Text>
      <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
        {description}
      </Text>
      {action}
    </View>
  );
}

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
  if (state.kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" size="large" />
        <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
          {copy.loading}
        </Text>
      </View>
    );
  }
  if (state.kind === "denied") {
    return (
      <Page>
        <MessageState description={copy.deniedDescription} title={copy.deniedTitle} />
      </Page>
    );
  }
  if (state.kind === "error") {
    return (
      <Page>
        <MessageState
          action={<Button label={copy.retry} onPress={onRetry} variant="secondary" />}
          description={state.message}
          title={copy.unavailableTitle}
        />
      </Page>
    );
  }

  const presentation = expensesScreenPresentation(state);
  return (
    <Page contentContainerClassName="gap-9">
      <ScreenHeader
        action={
          presentation.showCreate ? (
            <Button label={copy.registerExpense} onPress={onRegisterExpense} variant="accent" />
          ) : undefined
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      {state.isStale ? <StaleNotice /> : null}

      <ExpenseFilters
        accounts={accounts}
        categoryOptions={categoryOptions}
        copy={copy}
        filters={filters}
        hasMoreAccounts={hasMoreAccounts}
        isLoadingMoreAccounts={isLoadingMoreAccounts}
        onApplyPeriod={onApplyPeriod}
        onFiltersChange={onFiltersChange}
        onLoadMoreAccounts={onLoadMoreAccounts}
        onPeriodChange={onPeriodChange}
        period={period}
        periodError={periodError}
      />

      {state.confirmation === "uncertain" ? (
        <View className="gap-3 border-l-4 border-warning bg-[#FFF6E8] p-4 dark:bg-[#3A2A18]">
          <Text accessibilityRole="alert" className="font-bold text-ink dark:text-[#F2E4D2]">
            {copy.uncertainTitle}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#D7C7B4]">
            {copy.uncertainDescription}
          </Text>
          <Button
            className="self-start"
            label={copy.checkStatus}
            onPress={onCheckMutationStatus}
            variant="secondary"
          />
        </View>
      ) : state.confirmation === "failed" ? (
        <View className="gap-3 border-l-4 border-danger bg-[#FFF1F1] p-4 dark:bg-[#3A2020]">
          <Text accessibilityRole="alert" className="font-bold text-danger dark:text-[#FFBABA]">
            {copy.mutationFailedTitle}
          </Text>
          {state.mutationMessage ? (
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
              {state.mutationMessage}
            </Text>
          ) : null}
          <Button className="self-start" label={copy.retry} onPress={onRetry} variant="secondary" />
        </View>
      ) : null}

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

      <View className="gap-4">
        <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
          {copy.historyTitle}
        </Text>
        {state.expenses.length === 0 ? (
          <MessageState
            action={
              presentation.showCreate ? (
                <Button label={copy.registerExpense} onPress={onRegisterExpense} variant="accent" />
              ) : undefined
            }
            description={copy.emptyDescription}
            title={copy.emptyTitle}
          />
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
            variant="secondary"
          />
        ) : null}
      </View>
    </Page>
  );
}
