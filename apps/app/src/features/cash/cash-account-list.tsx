import type { CashAccount } from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";

type CashAccountListProps = {
  accounts: CashAccount[];
  activeLabel: string;
  archivedLabel: string;
  negativeAllowedLabel: string;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onOpenAccount: (accountId: string) => void;
};

export function CashAccountList({
  accounts,
  activeLabel,
  archivedLabel,
  negativeAllowedLabel,
  formatMoney,
  onOpenAccount,
}: CashAccountListProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<CashAccount>[]>(
    () => [
      {
        id: "name",
        header: t("dataTable.columns.name"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-foreground">{original.name}</Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original } }) => (
          <View className="gap-1">
            <Text className="font-sans text-foreground">
              {original.status === "active" ? activeLabel : archivedLabel}
            </Text>
            {original.allowNegativeBalance ? (
              <Text className="font-sans text-sm text-muted-foreground">
                {negativeAllowedLabel}
              </Text>
            ) : null}
          </View>
        ),
      },
      {
        id: "currency",
        header: t("dataTable.columns.currency"),
        cell: ({ row: { original } }) => (
          <Text className="font-sans text-muted-foreground">{original.currency}</Text>
        ),
      },
      {
        id: "balance",
        header: t("dataTable.columns.balance"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-foreground">
            {formatMoney(
              original.balanceMinorUnits,
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
          <Button
            label={t("dataTable.openRecord", { name: original.name })}
            onPress={() => onOpenAccount(original.id)}
            size="sm"
            variant="ghost"
          />
        ),
      },
    ],
    [t, activeLabel, archivedLabel, negativeAllowedLabel, formatMoney, onOpenAccount],
  );
  return (
    <DataTable
      caption={t("filters.accounts")}
      columns={columns}
      data={accounts}
      getRowId={(account) => account.id}
    />
  );
}
