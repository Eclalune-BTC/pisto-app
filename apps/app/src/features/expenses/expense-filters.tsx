import type { CashAccount, ExpenseCategory, ExpenseStatus } from "@pisto/contracts";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { type CursorPage, LoadMoreButton } from "@/components/ui/load-more-button";
import { SelectField } from "@/components/ui/select-field";
import { expenseCategoryOptions } from "./copy";
import { defaultExpenseFilters, type ExpenseHistoryFilters } from "./search-params";

type ExpenseFiltersProps = {
  accounts: CashAccount[];
  accountsPage: CursorPage;
  filters: ExpenseHistoryFilters;
  onFiltersChange: (next: ExpenseHistoryFilters) => void;
};

/** Filters the history only; the period summary has its own date range. */
export function ExpenseFilters({
  accounts,
  accountsPage,
  filters,
  onFiltersChange,
}: ExpenseFiltersProps) {
  const { t } = useTranslation();
  const filtered =
    filters.status !== defaultExpenseFilters.status ||
    filters.category !== defaultExpenseFilters.category ||
    filters.accountId !== defaultExpenseFilters.accountId;
  return (
    <FilterToolbar
      label={t("expenses.overview.filtersLabel")}
      onReset={filtered ? () => onFiltersChange(defaultExpenseFilters) : undefined}
      resetLabel={t("filters.reset")}
    >
      <FilterBar<ExpenseStatus | "all">
        label={t("expenses.overview.statusFilter")}
        onChange={(status) => onFiltersChange({ ...filters, status })}
        options={[
          { label: t("expenses.overview.statusOptions.all"), value: "all" },
          { label: t("expenses.overview.statusOptions.posted"), value: "posted" },
          { label: t("expenses.overview.statusOptions.voided"), value: "voided" },
        ]}
        value={filters.status}
      />
      <View className="min-w-0 grow basis-[180px] sm:max-w-[220px] sm:grow-0">
        <SelectField<ExpenseCategory | "all">
          label={t("expenses.overview.categoryFilter")}
          labelHidden
          onChange={(category) => onFiltersChange({ ...filters, category })}
          options={[
            { label: t("expenses.overview.allCategories"), value: "all" },
            ...expenseCategoryOptions(t),
          ]}
          value={filters.category}
        />
      </View>
      <View className="min-w-0 grow basis-[180px] flex-row items-center gap-2 sm:max-w-[280px] sm:grow-0">
        <View className="min-w-0 flex-1">
          <SelectField
            label={t("expenses.overview.accountFilter")}
            labelHidden
            onChange={(accountId) => onFiltersChange({ ...filters, accountId })}
            options={[
              { label: t("expenses.overview.allAccounts"), value: "all" },
              ...accounts.map(({ id, name }) => ({ label: name, value: id })),
            ]}
            value={filters.accountId}
          />
        </View>
        <LoadMoreButton label={t("cash.fields.loadMoreAccounts")} page={accountsPage} />
      </View>
    </FilterToolbar>
  );
}
