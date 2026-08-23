import type { CashAccount, ExpenseCategory, ExpenseStatus } from "@pisto/contracts";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ChoiceList, type ChoiceOption } from "../cash/choice-list";

export type ExpenseFiltersValue = {
  accountId: string;
  category: ExpenseCategory | "all";
  status: ExpenseStatus | "all";
};

export type ExpensePeriodValue = {
  endLocalDate: string;
  startLocalDate: string;
};

export type ExpenseFiltersCopy = {
  accountFilter: string;
  allAccounts: string;
  allCategories: string;
  allStatuses: string;
  applyPeriod: string;
  categoryFilter: string;
  endDate: string;
  filtersTitle: string;
  loadMore: string;
  loadingMore: string;
  postedStatus: string;
  periodScope: string;
  startDate: string;
  statusFilter: string;
  voidedStatus: string;
};

type ExpenseFiltersProps = {
  accounts: CashAccount[];
  categoryOptions: readonly ChoiceOption<ExpenseCategory>[];
  copy: ExpenseFiltersCopy;
  filters: ExpenseFiltersValue;
  hasMoreAccounts: boolean;
  isLoadingMoreAccounts: boolean;
  onApplyPeriod: () => void;
  onFiltersChange: (next: ExpenseFiltersValue) => void;
  onLoadMoreAccounts: () => void;
  onPeriodChange: (next: ExpensePeriodValue) => void;
  period: ExpensePeriodValue;
  periodError?: string;
};

export function ExpenseFilters({
  accounts,
  categoryOptions,
  copy,
  filters,
  hasMoreAccounts,
  isLoadingMoreAccounts,
  onApplyPeriod,
  onFiltersChange,
  onLoadMoreAccounts,
  onPeriodChange,
  period,
  periodError,
}: ExpenseFiltersProps) {
  return (
    <View className="gap-6 border-y border-line py-6 dark:border-[#304239]">
      <Text accessibilityRole="header" className="text-lg font-black text-ink dark:text-white">
        {copy.filtersTitle}
      </Text>
      <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
        {copy.periodScope}
      </Text>
      <View className="gap-6 lg:flex-row lg:items-start">
        <View className="min-w-0 flex-1 gap-5">
          <ChoiceList
            label={copy.statusFilter}
            onChange={(status) => onFiltersChange({ ...filters, status })}
            options={[
              { label: copy.postedStatus, value: "posted" },
              { label: copy.voidedStatus, value: "voided" },
              { label: copy.allStatuses, value: "all" },
            ]}
            value={filters.status}
          />
          <ChoiceList
            label={copy.categoryFilter}
            onChange={(category) => onFiltersChange({ ...filters, category })}
            options={[{ label: copy.allCategories, value: "all" }, ...categoryOptions]}
            value={filters.category}
          />
        </View>
        <View className="min-w-0 flex-1 gap-5">
          <ChoiceList
            label={copy.accountFilter}
            onChange={(accountId) => onFiltersChange({ ...filters, accountId })}
            options={[
              { label: copy.allAccounts, value: "all" },
              ...accounts.map(({ id, name }) => ({ label: name, value: id })),
            ]}
            value={filters.accountId}
          />
          {hasMoreAccounts ? (
            <Button
              className="self-start"
              label={isLoadingMoreAccounts ? copy.loadingMore : copy.loadMore}
              loading={isLoadingMoreAccounts}
              onPress={onLoadMoreAccounts}
              size="sm"
              variant="secondary"
            />
          ) : null}
        </View>
      </View>
      <View className="gap-4 sm:flex-row sm:items-end">
        <View className="min-w-0 flex-1">
          <Field
            error={periodError}
            label={copy.startDate}
            onChangeText={(startLocalDate) => onPeriodChange({ ...period, startLocalDate })}
            value={period.startLocalDate}
          />
        </View>
        <View className="min-w-0 flex-1">
          <Field
            label={copy.endDate}
            onChangeText={(endLocalDate) => onPeriodChange({ ...period, endLocalDate })}
            value={period.endLocalDate}
          />
        </View>
        <Button label={copy.applyPeriod} onPress={onApplyPeriod} variant="secondary" />
      </View>
    </View>
  );
}
