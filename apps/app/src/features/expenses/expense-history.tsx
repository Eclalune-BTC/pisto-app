import type { Expense } from "@pisto/contracts";
import type { Href } from "expo-router";
import { Ban } from "lucide-react-native";
import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { RowActions } from "@/components/ui/row-actions";
import { Text } from "@/components/ui/text";
import { CashAccountName } from "../cash/cash-account-name";
import { expenseCategoryLabels, expenseStatusLabels } from "./copy";

type ExpenseHistoryProps = {
  /** Names already loaded on this page, keyed by account. */
  accountNames: ReadonlyMap<string, string>;
  businessId: string;
  empty: ReactElement;
  expenses: Expense[];
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  formatOccurredAt: (expense: Expense) => string;
  /** Present only for a manager allowed to void; voided rows never offer it. */
  onVoidExpense?: (expense: Expense) => void;
  /** A status filter of one value already states every row's status. */
  showStatus: boolean;
};

export function expenseHref(expenseId: string): Href {
  return { pathname: "/operate/expenses/[expenseId]", params: { expenseId } };
}

export function ExpenseHistory({
  accountNames,
  businessId,
  empty,
  expenses,
  formatMoney,
  formatOccurredAt,
  onVoidExpense,
  showStatus,
}: ExpenseHistoryProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<Expense>[]>(() => {
    const categories = expenseCategoryLabels(t);
    const statuses = expenseStatusLabels(t);
    return [
      {
        id: "description",
        header: t("dataTable.columns.description"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]" numberOfLines={2}>
            {original.description}
          </Text>
        ),
      },
      {
        id: "category",
        header: t("dataTable.columns.category"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground">{categories[original.category]}</Text>
        ),
      },
      {
        id: "account",
        header: t("dataTable.columns.account"),
        cell: ({ row: { original } }) => (
          <CashAccountName
            accountId={original.accountId}
            businessId={businessId}
            className="text-muted-foreground"
            knownName={accountNames.get(original.accountId)}
          />
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
            {formatOccurredAt(original)}
          </Text>
        ),
      },
      ...(showStatus
        ? [
            {
              id: "status",
              header: t("dataTable.columns.status"),
              cell: ({ row: { original } }) => (
                <Badge variant={original.status === "voided" ? "outline" : "secondary"}>
                  <Text>{statuses[original.status]}</Text>
                </Badge>
              ),
            } satisfies DataTableColumn<Expense>,
          ]
        : []),
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text
            className={
              original.status === "voided"
                ? "font-ui text-[13px] text-muted-foreground tabular-nums line-through"
                : "font-ui text-[13px] tabular-nums"
            }
          >
            {formatMoney(
              original.amountMinorUnits,
              original.currency,
              original.currencyMinorUnitDigits,
            )}
          </Text>
        ),
      },
    ];
  }, [accountNames, businessId, formatMoney, formatOccurredAt, showStatus, t]);
  return (
    <DataTable
      caption={t("filters.history")}
      columns={columns}
      data={expenses}
      empty={empty}
      getRowHref={(expense) => expenseHref(expense.id)}
      getRowId={(expense) => expense.id}
      rowActions={
        onVoidExpense
          ? (expense) =>
              expense.status === "posted" ? (
                <RowActions
                  actions={[
                    {
                      destructive: true,
                      icon: Ban,
                      label: t("expenses.void.action"),
                      onPress: () => onVoidExpense(expense),
                    },
                  ]}
                  label={t("expenses.overview.rowActions", { name: expense.description })}
                />
              ) : null
          : undefined
      }
    />
  );
}
