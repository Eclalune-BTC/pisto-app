import type { CashMovement, CashMovementAction } from "@pisto/contracts";
import { ArrowLeftRight } from "lucide-react-native";
import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { cashMovementReason } from "./copy";

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
              // Rows share type names, so the occurrence tells them apart for screen readers.
              accessibilityLabel={
                formatOccurredAt
                  ? t("cash.movements.rowLabel", {
                      action: actionLabels[original.action],
                      date: formatOccurredAt(original),
                    })
                  : undefined
              }
              className="min-h-0 w-full justify-start px-0 py-0"
              // On native this cell is the row's only touch target; keep it near 44 points.
              hitSlop={12}
              onPress={() => onOpenMovement(original.id)}
              variant="link"
            >
              <Text className="font-ui text-left text-dense text-foreground no-underline web:hover:underline">
                {actionLabels[original.action]}
              </Text>
            </Button>
          ) : (
            <Text className="text-dense">{actionLabels[original.action]}</Text>
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
                <Text className="text-dense text-muted-foreground tabular-nums" numberOfLines={1}>
                  {formatOccurredAt(original)}
                </Text>
              ),
            } satisfies DataTableColumn<CashMovement>,
          ]
        : []),
      {
        id: "reason",
        header: t("cash.movements.reason"),
        // Rows of one type look alike; the reason tells them apart, on phones too.
        cell: ({ row: { original } }) => (
          <Text className="text-dense text-muted-foreground" numberOfLines={2}>
            {cashMovementReason(t, original)}
          </Text>
        ),
      },
      {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        // Signed like the Movimientos ledger: money in carries a plus and the positive tone.
        cell: ({ row: { original } }) => {
          const amount = formatMoney(
            original.deltaMinorUnits,
            original.currency,
            original.currencyMinorUnitDigits,
          );
          const incoming =
            !original.deltaMinorUnits.startsWith("-") && original.deltaMinorUnits !== "0";
          return (
            <Text
              className={cn(
                "font-ui text-dense tabular-nums",
                incoming && "text-positive-foreground",
              )}
            >
              {incoming ? `+${amount}` : amount}
            </Text>
          );
        },
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
