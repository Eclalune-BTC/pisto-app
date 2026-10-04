import type { InventoryMovement, Product } from "@pisto/contracts";
import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { MissingValue } from "../catalog/catalog-cells";
import { formatLocalMoment, signedQuantityText } from "../catalog/format";

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
 * A product's append-only movements as the server ordered them. A reversal and its original are
 * linked through the reference column, which only appears while one of the rows has a link.
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
  const columns = useMemo<DataTableColumn<InventoryMovement>[]>(() => {
    const loaded = new Map(movements.map((movement) => [movement.id, movement]));
    const linked = movements.some(
      ({ reversedByMovementId, reversesMovementId }) =>
        reversedByMovementId !== null || reversesMovementId !== null,
    );
    return [
      {
        id: "type",
        header: t("dataTable.columns.type"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Badge variant="outline">
            <Text>{t(`inventory.movementActions.${original.action}`)}</Text>
          </Badge>
        ),
      },
      {
        id: "occurredAt",
        header: t("inventory.history.occurredAt"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
            {movementMoment(original, locale)}
          </Text>
        ),
      },
      {
        id: "reason",
        header: t("inventory.history.reason"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]" numberOfLines={2}>
            {original.reason}
          </Text>
        ),
      },
      ...(linked
        ? [
            {
              id: "reference",
              header: t("dataTable.columns.reference"),
              cell: ({ row: { original } }) => {
                if (original.reversedByMovementId !== null) {
                  const reversal = loaded.get(original.reversedByMovementId);
                  return (
                    <View className="min-w-0 flex-row flex-wrap items-center gap-1.5">
                      <Badge className="bg-foreground/20" variant="secondary">
                        <Text>{t("inventory.history.reversed")}</Text>
                      </Badge>
                      {reversal ? (
                        <Text className="text-xs text-muted-foreground tabular-nums">
                          {movementMoment(reversal, locale)}
                        </Text>
                      ) : null}
                    </View>
                  );
                }
                if (original.reversesMovementId !== null) {
                  const reversed = loaded.get(original.reversesMovementId);
                  return (
                    <Text className="text-[13px] text-muted-foreground" numberOfLines={2}>
                      {reversed
                        ? t("inventory.history.reverses", {
                            action: t(`inventory.movementActions.${reversed.action}`),
                            date: movementMoment(reversed, locale),
                          })
                        : t("inventory.history.reversesEarlier")}
                    </Text>
                  );
                }
                return <MissingValue label={t("inventory.history.noReference")} />;
              },
            } satisfies DataTableColumn<InventoryMovement>,
          ]
        : []),
      {
        id: "quantity",
        header: t("dataTable.columns.quantity"),
        meta: { align: "end", width: 150 },
        cell: ({ row: { original } }) => (
          <Text className="font-ui text-[13px] tabular-nums" numberOfLines={1}>
            {signedQuantityText(t, locale, {
              deltaMinorUnits: original.deltaMinorUnits,
              precision: original.quantityPrecision,
              unitKind: product.unitKind,
            })}
          </Text>
        ),
      },
    ];
  }, [locale, movements, product.unitKind, t]);
  return (
    <DataTable
      caption={caption}
      columns={columns}
      data={movements}
      empty={empty}
      getRowId={(movement) => movement.id}
      rowActions={rowActions}
    />
  );
}
