import type { Expense, ExpenseCategory } from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";

type ExpenseHistoryProps = {
  expenses: Expense[];
  canManage: boolean;
  postedLabel: string;
  voidedLabel: string;
  voidActionLabel: string;
  categoryLabels: Record<ExpenseCategory, string>;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onOpenExpense: (expenseId: string) => void;
  onVoidExpense: (expenseId: string) => void;
};

export function ExpenseHistory({
  expenses,
  canManage,
  postedLabel,
  voidedLabel,
  voidActionLabel,
  categoryLabels,
  formatMoney,
  onOpenExpense,
  onVoidExpense,
}: ExpenseHistoryProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<Expense>[]>(
    () => [
      {
        id: "description",
        header: t("dataTable.columns.description"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Button
            accessibilityLabel={t("dataTable.openRecord", { name: original.description })}
            className="justify-start px-0"
            label={original.description}
            onPress={() => onOpenExpense(original.id)}
            size="sm"
            variant="ghost"
          />
        ),
      },
      {
        id: "category",
        header: t("dataTable.columns.category"),
        cell: ({ row: { original } }) => (
          <Text className="font-sans text-foreground">{categoryLabels[original.category]}</Text>
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original } }) => (
          <Text className="font-sans text-muted-foreground">{original.occurredLocalDate}</Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original } }) => (
          <Text className="font-sans text-foreground">
            {original.status === "posted" ? postedLabel : voidedLabel}
          </Text>
        ),
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-foreground">
            {formatMoney(
              original.amountMinorUnits,
              original.currency,
              original.currencyMinorUnitDigits,
            )}
          </Text>
        ),
      },
      {
        id: "actions",
        header: t("dataTable.columns.actions"),
        cell: ({ row: { original } }) => (
          <View className="min-w-0 items-start gap-2">
            {canManage && original.status === "posted" ? (
              <Button
                label={voidActionLabel}
                onPress={() => onVoidExpense(original.id)}
                size="sm"
                variant="ghost"
              />
            ) : null}
          </View>
        ),
      },
    ],
    [
      t,
      categoryLabels,
      postedLabel,
      voidedLabel,
      formatMoney,
      canManage,
      onOpenExpense,
      onVoidExpense,
      voidActionLabel,
    ],
  );
  return (
    <DataTable
      caption={t("filters.history")}
      columns={columns}
      data={expenses}
      getRowId={(expense) => expense.id}
    />
  );
}
