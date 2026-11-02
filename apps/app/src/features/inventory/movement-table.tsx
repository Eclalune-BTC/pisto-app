import type { InventoryMovement, Product } from "@pisto/contracts";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { type FittedColumn, fitColumns } from "@/components/ui/fit-columns";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { formatLocalMoment } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { MissingValue } from "../catalog/catalog-cells";
import { signedQuantityText } from "../catalog/format";

type MovementTableProps = {
  caption: string;
  empty: ReactElement;
  movements: InventoryMovement[];
  product: Product;
  rowActions?: (movement: InventoryMovement) => ReactElement | null;
};

export function movementMoment(movement: InventoryMovement, locale: string): string {
  return formatLocalMoment(movement.occurredLocalDate, movement.occurredLocalTime, locale);
}

/**
 * A product's append-only movements as the server ordered them. A reversed movement keeps its row
 * with a "Revertido" chip and a struck-through quantity; a reversal names the movement it reverses,
 * in a column of its own while the table has room and under its type otherwise.
 */
export function MovementTable({
  caption,
  empty,
  movements,
  product,
  rowActions,
}: MovementTableProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const { onLayout, width } = useMeasuredWidth();
  const loaded = new Map(movements.map((movement) => [movement.id, movement]));
  const hasReversals = movements.some(({ reversesMovementId }) => reversesMovementId !== null);

  const reversedMovement = (movement: InventoryMovement): string | null => {
    if (movement.reversesMovementId === null) return null;
    const reversed = loaded.get(movement.reversesMovementId);
    return reversed
      ? t("inventory.history.reverses", {
          action: t(`inventory.movementActions.${reversed.action}`),
          date: movementMoment(reversed, locale),
        })
      : t("inventory.history.reversesEarlier");
  };

  const typeColumn = (withReference: boolean): DataTableColumn<InventoryMovement> => ({
    id: "type",
    header: t("dataTable.columns.type"),
    meta: { primary: true },
    cell: ({ row: { original } }) => {
      const reference = withReference ? reversedMovement(original) : null;
      return (
        <View className="min-w-0 gap-1">
          <View className="min-w-0 flex-row flex-wrap items-center gap-1.5">
            <Badge variant="outline">
              <Text>{t(`inventory.movementActions.${original.action}`)}</Text>
            </Badge>
            {original.reversedByMovementId !== null ? (
              <StatusBadge label={t("inventory.history.reversed")} tone="exception" />
            ) : null}
          </View>
          {reference ? (
            <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={2}>
              {reference}
            </Text>
          ) : null}
        </View>
      );
    },
  });

  const fitted = (typeShowsReference: boolean) =>
    fitColumns<InventoryMovement>(
      [
        { column: typeColumn(typeShowsReference), estimate: 200 },
        {
          column: {
            id: "occurredAt",
            header: t("inventory.history.occurredAt"),
            cell: ({ row: { original } }) => (
              <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
                {movementMoment(original, locale)}
              </Text>
            ),
          },
          estimate: 170,
        },
        {
          column: {
            id: "reason",
            header: t("inventory.history.reason"),
            cell: ({ row: { original } }) => (
              <Text className="text-[13px]" numberOfLines={2}>
                {original.reason ?? t("inventory.systemReasons.sale")}
              </Text>
            ),
          },
          estimate: 220,
        },
        ...(hasReversals && !typeShowsReference
          ? [
              {
                column: {
                  id: "reference",
                  header: t("dataTable.columns.reference"),
                  cell: ({ row: { original } }) => {
                    const reference = reversedMovement(original);
                    return reference ? (
                      <Text className="text-[13px] text-muted-foreground" numberOfLines={2}>
                        {reference}
                      </Text>
                    ) : (
                      <MissingValue label={t("inventory.history.noReference")} />
                    );
                  },
                },
                dropRank: 0,
                estimate: 260,
                only: "table",
              } satisfies FittedColumn<InventoryMovement>,
            ]
          : []),
        {
          column: {
            id: "quantity",
            header: t("dataTable.columns.quantity"),
            meta: { align: "end", width: 150 },
            cell: ({ row: { original } }) => (
              <Text
                className={cn(
                  "font-ui text-[13px] tabular-nums",
                  // The reversal row next to it carries the change that now counts.
                  original.reversedByMovementId !== null && "text-muted-foreground line-through",
                )}
                numberOfLines={1}
              >
                {signedQuantityText(t, locale, {
                  deltaMinorUnits: original.deltaMinorUnits,
                  precision: original.quantityPrecision,
                  unitKind: product.unitKind,
                })}
              </Text>
            ),
          },
          estimate: 150,
        },
      ],
      width,
    );
  const table = fitted(false);
  // Compact rows and narrow tables have no reference column; the type cell names it instead.
  const columns =
    hasReversals && !table.some(({ id }) => id === "reference") ? fitted(true) : table;

  return (
    <View className="min-w-0" onLayout={onLayout}>
      <DataTable
        caption={caption}
        columns={columns}
        data={movements}
        empty={empty}
        getRowId={(movement) => movement.id}
        rowActions={rowActions}
      />
    </View>
  );
}
