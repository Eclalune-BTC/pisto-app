import type { Purchase } from "@pisto/contracts";
import type { Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { type FittedColumn, fitColumns, rendersCompactRecords } from "@/components/ui/fit-columns";
import { Text } from "@/components/ui/text";
import { useRecordFormat } from "@/features/customers/format";
import { MoneyText } from "@/features/customers/money-text";
import { useMeasuredWidth } from "@/lib/use-measured-width";

import { PurchaseStateBadge } from "./presentation";

type PurchasesTableProps = {
  caption: string;
  items: Purchase[];
  /** Offered on rows that still owe money, when the member may pay. */
  onRegisterPayment?: (purchase: Purchase) => void;
  /** Off when every row is of one supplier, such as a supplier's own purchases. */
  showSupplier?: boolean;
};

function DateText({ value }: { value: string }) {
  return (
    <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
      {value}
    </Text>
  );
}

export function PurchasesTable({
  caption,
  items,
  onRegisterPayment,
  showSupplier = true,
}: PurchasesTableProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const { onLayout, width } = useMeasuredWidth();
  const invoice = (purchase: Purchase) =>
    purchase.invoiceNumber
      ? t("purchases.payables.invoice", { number: purchase.invoiceNumber })
      : t("purchases.payables.noInvoice");
  const entries: FittedColumn<Purchase>[] = [
    {
      estimate: 220,
      column: {
        id: "supplier",
        header: showSupplier
          ? t("purchases.payables.columns.supplier")
          : t("purchases.detail.invoice"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <View className="min-w-0 max-w-[16rem]">
            <Text className="text-[13px]" numberOfLines={1}>
              {showSupplier ? original.supplierName : invoice(original)}
            </Text>
            {showSupplier ? (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {invoice(original)}
              </Text>
            ) : null}
          </View>
        ),
      },
    },
    {
      estimate: 110,
      dropRank: 1,
      only: "table",
      column: {
        id: "purchased",
        header: t("purchases.payables.columns.purchased"),
        cell: ({ row: { original } }) => (
          <DateText value={format.date(original.occurredLocalDate)} />
        ),
      },
    },
    {
      estimate: 110,
      column: {
        id: "due",
        header: t("purchases.payables.columns.due"),
        cell: ({ row: { original } }) =>
          original.dueDate ? (
            <DateText value={format.date(original.dueDate)} />
          ) : (
            <Text className="text-[13px] text-muted-foreground">
              {t("purchases.payables.paidCash")}
            </Text>
          ),
      },
    },
    {
      estimate: 110,
      column: {
        id: "state",
        header: t("purchases.payables.columns.state"),
        cell: ({ row: { original } }) => <PurchaseStateBadge purchase={original} />,
      },
    },
    {
      estimate: 100,
      column: {
        id: "balance",
        header: t("purchases.payables.columns.balance"),
        meta: { align: "end", figure: true },
        cell: ({ row: { original } }) => (
          <MoneyText
            currency={original.currency}
            digits={original.currencyMinorUnitDigits}
            minorUnits={original.balanceMinorUnits}
            overdue={original.payableState === "overdue"}
          />
        ),
      },
    },
  ];
  return (
    <View className="min-w-0" onLayout={onLayout}>
      <DataTable
        caption={caption}
        columns={fitColumns(entries, width)}
        data={items}
        getRowHref={(purchase): Href => ({
          pathname: "/operate/purchases/[purchaseId]",
          params: { purchaseId: purchase.id },
        })}
        getRowId={(purchase) => purchase.id}
        rowActions={
          onRegisterPayment
            ? (purchase) =>
                purchase.status === "posted" && BigInt(purchase.balanceMinorUnits) > 0n ? (
                  <Button
                    accessibilityLabel={`${t("purchases.payables.registerPayment")}: ${purchase.supplierName}`}
                    onPress={() => onRegisterPayment(purchase)}
                    size="sm"
                    variant="ghost"
                  >
                    <Text className="web:whitespace-nowrap">
                      {rendersCompactRecords(width)
                        ? t("purchases.payables.pay")
                        : t("purchases.payables.registerPayment")}
                    </Text>
                  </Button>
                ) : null
            : undefined
        }
      />
    </View>
  );
}
