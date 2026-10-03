import type { CashAccount, ExpenseCategory, ExpenseStatus } from "@pisto/contracts";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { FilterBar, type FilterOption } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { SelectField } from "@/components/ui/select-field";

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
  categoryOptions: readonly FilterOption<ExpenseCategory>[];
  copy: ExpenseFiltersCopy;
  filters: ExpenseFiltersValue;
  hasMoreAccounts: boolean;
  isLoadingMoreAccounts: boolean;
  onFiltersChange: (next: ExpenseFiltersValue) => void;
  onLoadMoreAccounts: () => void;
};

export function ExpenseFilters({
  accounts,
  categoryOptions,
  copy,
  filters,
  hasMoreAccounts,
  isLoadingMoreAccounts,
  onFiltersChange,
  onLoadMoreAccounts,
}: ExpenseFiltersProps) {
  const { t } = useTranslation();
  const hasFilters =
    filters.status !== "posted" || filters.category !== "all" || filters.accountId !== "all";
  return (
    <FilterToolbar
      label={copy.filtersTitle}
      onReset={
        hasFilters
          ? () => onFiltersChange({ status: "posted", category: "all", accountId: "all" })
          : undefined
      }
      resetLabel={t("filters.reset")}
    >
      <View className="min-w-0 gap-2 sm:flex-1">
        <FilterBar
          showLabel
          label={copy.statusFilter}
          onChange={(status) => onFiltersChange({ ...filters, status })}
          options={[
            { label: copy.postedStatus, value: "posted" },
            { label: copy.voidedStatus, value: "voided" },
            { label: copy.allStatuses, value: "all" },
          ]}
          value={filters.status}
        />
      </View>
      <View className="min-w-0 gap-2 sm:min-w-48 sm:flex-1">
        <SelectField
          label={copy.categoryFilter}
          onChange={(category) => onFiltersChange({ ...filters, category })}
          options={[{ label: copy.allCategories, value: "all" }, ...categoryOptions]}
          value={filters.category}
        />
      </View>
      <View className="min-w-0 gap-2 sm:min-w-48 sm:flex-1">
        <SelectField
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
            variant="outline"
          />
        ) : null}
      </View>
    </FilterToolbar>
  );
}
