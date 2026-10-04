import type { CashMovement, CashMovementAction } from "@pisto/contracts";
import { ArrowLeftRight } from "lucide-react-native";
import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";

type CashMovementListProps = {
  actionLabels: Record<CashMovementAction, string>;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  /** Business-local occurrence of a movement. */
  formatOccurredAt?: (movement: CashMovement) => string;
  movements: CashMovement[];
  noMovements: string;
  /** Opens a movement's facts; without it the rows are read-only. */
  onOpenMovement?: (movementId: string) => void;
  /** Names the account on lists that span several accounts. */
  renderAccount?: (movement: CashMovement) => ReactElement;
};

export function CashMovementList({
  actionLabels,
  formatMoney,
  formatOccurredAt,
  movements,
  noMovements,
  onOpenMovement,
  renderAccount,
}: CashMovementListProps) {
  const { t } = useTranslation();
  const columns = useMemo<DataTableColumn<CashMovement>[]>(
    () => [
      {
        id: "type",
        header: t("dataTable.columns.type"),
        meta: { primary: true },
        cell: ({ row: { original } }) =>
          onOpenMovement ? (
            <Button
              className="min-h-0 self-start px-0 py-0"
              hitSlop={8}
              onPress={() => onOpenMovement(original.id)}
              variant="link"
            >
              <Text className="font-ui text-[13px] text-foreground no-underline web:hover:underline">
                {actionLabels[original.action]}
              </Text>
            </Button>
          ) : (
            <Text className="text-[13px]">{actionLabels[original.action]}</Text>
          ),
      },
      ...(renderAccount
        ? [
            {
              id: "account",
              header: t("dataTable.columns.account"),
              cell: ({ row: { original } }) => renderAccount(original),
            } satisfies DataTableColumn<CashMovement>,
          ]
        : []),
      ...(formatOccurredAt
        ? [
            {
              id: "date",
              header: t("dataTable.columns.date"),
              cell: ({ row: { original } }) => (
                <Text className="text-[13px] text-muted-foreground tabular-nums">
                  {formatOccurredAt(original)}
                </Text>
              ),
            } satisfies DataTableColumn<CashMovement>,
          ]
        : []),
      {
        id: "reason",
        header: t("cash.movements.reason"),
        meta: { hideOnCompact: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
            {original.reason}
          </Text>
        ),
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-[13px] tabular-nums">
            {formatMoney(
              original.deltaMinorUnits,
              original.currency,
              original.currencyMinorUnitDigits,
            )}
          </Text>
        ),
      },
    ],
    [actionLabels, formatMoney, formatOccurredAt, onOpenMovement, renderAccount, t],
  );
  return (
    <DataTable
      caption={t("filters.movements")}
      columns={columns}
      data={movements}
      empty={
        <EmptyState
          description={noMovements}
          icon={ArrowLeftRight}
          title={t("cash.movements.emptyTitle")}
        />
      }
      getRowId={(movement) => movement.id}
    />
  );
}
