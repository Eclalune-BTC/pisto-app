import type { SaleLine } from "@pisto/contracts";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { formatQuantity } from "@/features/inventory/quantity";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";

/** The lines a sale charged, with the name, quantity and price it recorded. */
export function SaleLinesTable({
  currency,
  currencyDigits,
  lines,
}: {
  currency: string;
  currencyDigits: number;
  lines: SaleLine[];
}) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const columns = useMemo<DataTableColumn<SaleLine>[]>(
    () => [
      {
        id: "product",
        header: t("sales.itemized.columns.product"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]" numberOfLines={2}>
            {original.productName}
          </Text>
        ),
      },
      {
        id: "quantity",
        header: t("sales.itemized.columns.quantity"),
        meta: { align: "end", width: 110 },
        cell: ({ row: { original } }) => (
          <Text className="text-right text-[13px] tabular-nums">
            {formatQuantity(original.quantityMinorUnits, original.quantityPrecision, locale)}
          </Text>
        ),
      },
      {
        id: "price",
        header: t("sales.itemized.columns.price"),
        meta: { align: "end", width: 120 },
        cell: ({ row: { original } }) => (
          <Text className="text-right text-[13px] tabular-nums">
            {formatMinorUnits(original.unitPriceMinorUnits, currency, currencyDigits, locale)}
          </Text>
        ),
      },
      {
        id: "subtotal",
        header: t("sales.itemized.columns.subtotal"),
        meta: { align: "end", figure: true, width: 130 },
        cell: ({ row: { original } }) => (
          <Text className="text-right font-ui text-[13px] tabular-nums">
            {formatMinorUnits(original.subtotalMinorUnits, currency, currencyDigits, locale)}
          </Text>
        ),
      },
    ],
    [currency, currencyDigits, locale, t],
  );
  return (
    <DataTable
      caption={t("sales.detail.productsTitle")}
      columns={columns}
      data={lines}
      getRowId={(line) => line.id}
    />
  );
}
