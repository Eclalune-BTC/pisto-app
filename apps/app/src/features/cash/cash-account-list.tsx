import type { CashAccount } from "@pisto/contracts";
import type { Href } from "expo-router";
import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { cashAccountKindLabels, cashAccountStatusLabels } from "./copy";

type CashAccountListProps = {
  accounts: CashAccount[];
  empty: ReactElement;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
};

export function accountHref(accountId: string): Href {
  return { pathname: "/operate/cash/accounts/[accountId]", params: { accountId } };
}

export function CashAccountList({ accounts, empty, formatMoney }: CashAccountListProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<CashAccount>[]>(() => {
    const kinds = cashAccountKindLabels(t);
    const statuses = cashAccountStatusLabels(t);
    return [
      {
        id: "name",
        header: t("dataTable.columns.name"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]" numberOfLines={2}>
            {original.name}
          </Text>
        ),
      },
      {
        id: "kind",
        header: t("dataTable.columns.type"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground">{kinds[original.kind]}</Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({ row: { original } }) => (
          <View className="flex-row flex-wrap gap-1">
            <StatusBadge
              label={statuses[original.status]}
              tone={original.status === "active" ? "normal" : "exception"}
            />
            {original.allowNegativeBalance ? (
              <Badge variant="outline">
                <Text>{t("cash.negativeAllowed")}</Text>
              </Badge>
            ) : null}
          </View>
        ),
      },
      {
        id: "currency",
        header: t("dataTable.columns.currency"),
        meta: { hideOnCompact: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground">{original.currency}</Text>
        ),
      },
      {
        id: "balance",
        header: t("dataTable.columns.balance"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text
            className={cn(
              "font-ui text-[13px] tabular-nums",
              original.balanceMinorUnits.startsWith("-") && "text-destructive",
            )}
          >
            {formatMoney(
              original.balanceMinorUnits,
              original.currency,
              original.currencyMinorUnitDigits,
            )}
          </Text>
        ),
      },
    ];
  }, [formatMoney, t]);
  return (
    <DataTable
      caption={t("filters.accounts")}
      columns={columns}
      data={accounts}
      empty={empty}
      getRowHref={(account) => accountHref(account.id)}
      getRowId={(account) => account.id}
    />
  );
}
