import type { CashMovement, CashMovementAction } from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";

type CashMovementListProps = {
  movements: CashMovement[];
  noMovements: string;
  actionLabels: Record<CashMovementAction, string>;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onOpenMovement?: (movementId: string) => void;
};

export function CashMovementList({
  movements,
  noMovements,
  actionLabels,
  formatMoney,
  onOpenMovement,
}: CashMovementListProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<CashMovement>[]>(
    () => [
      {
        id: "type",
        header: t("dataTable.columns.type"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-foreground">{actionLabels[original.action]}</Text>
        ),
      },
      {
        id: "date",
        header: t("dataTable.columns.date"),
        cell: ({ row: { original } }) => (
          <Text className="font-sans text-muted-foreground">
            {original.occurredLocalDate} {original.occurredLocalTime}
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
              original.deltaMinorUnits,
              original.currency,
              original.currencyMinorUnitDigits,
            )}
          </Text>
        ),
      },
      ...(onOpenMovement
        ? [
            {
              id: "actions",
              header: t("dataTable.columns.actions"),
              cell: ({ row: { original } }) => (
                <Button
                  label={t("dataTable.openRecord", { name: actionLabels[original.action] })}
                  onPress={() => onOpenMovement(original.id)}
                  size="sm"
                  variant="ghost"
                />
              ),
            } satisfies DataTableColumn<CashMovement>,
          ]
        : []),
    ],
    [t, actionLabels, formatMoney, onOpenMovement],
  );
  return (
    <DataTable
      caption={t("filters.movements")}
      columns={columns}
      data={movements}
      empty={<EmptyState title={t("filters.movements")} description={noMovements} />}
      getRowId={(movement) => movement.id}
    />
  );
}
