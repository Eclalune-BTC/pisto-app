import type { Receivable } from "@pisto/contracts";
import type { Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { DataTable } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { CellText } from "@/features/customers/cell-text";
import { type FittedColumn, fitColumns } from "@/features/customers/fit-columns";
import { useRecordFormat } from "@/features/customers/format";
import { MoneyText } from "@/features/customers/money-text";
import { useMeasuredWidth } from "@/features/customers/use-measured-width";

import { ReceivableStateBadge } from "./receivable-state-badge";

export type CustomerNameCell =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; name: string };

type ReceivableRow = { customer?: CustomerNameCell; receivable: Receivable };

type ReceivablesTableProps = {
  caption: string;
  /** Adds the customer as the record name; the receivables of a single customer omit it. */
  customerNameFor?: (customerId: string) => CustomerNameCell;
  items: Receivable[];
  /** Off when every row shares one state, such as a list filtered by state. */
  showState?: boolean;
};

function CustomerName({ customer }: { customer: CustomerNameCell | undefined }) {
  const { t } = useTranslation();
  return customer?.kind === "ready" ? (
    <CellText maxWidth="max-w-[11rem]">{customer.name}</CellText>
  ) : (
    <CellText className="text-muted-foreground" maxWidth="max-w-[11rem]">
      {customer?.kind === "loading"
        ? t("receivables.list.customerLoading")
        : t("receivables.list.customerUnavailable")}
    </CellText>
  );
}

function DateText({ value }: { value: string }) {
  return (
    <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
      {value}
    </Text>
  );
}

export function ReceivablesTable({
  caption,
  customerNameFor,
  items,
  showState = true,
}: ReceivablesTableProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const { onLayout, width } = useMeasuredWidth();
  const withCustomer = customerNameFor !== undefined;
  const money = ({ receivable }: ReceivableRow, minorUnits: string) => (
    <MoneyText
      currency={receivable.currency}
      digits={receivable.currencyMinorUnitDigits}
      minorUnits={minorUnits}
    />
  );
  const entries: FittedColumn<ReceivableRow>[] = [
    ...(withCustomer
      ? [
          {
            estimate: 200,
            column: {
              id: "customer",
              header: t("dataTable.columns.customer"),
              meta: { primary: true },
              cell: ({ row: { original } }) => <CustomerName customer={original.customer} />,
            },
          } satisfies FittedColumn<ReceivableRow>,
        ]
      : []),
    {
      estimate: withCustomer ? 216 : 280,
      dropRank: withCustomer ? 2 : undefined,
      column: {
        id: "description",
        header: t("dataTable.columns.description"),
        meta: withCustomer ? undefined : { primary: true },
        cell: ({ row: { original } }) => (
          <CellText
            className={withCustomer ? "text-muted-foreground" : undefined}
            maxWidth={withCustomer ? "max-w-[12rem]" : "max-w-[16rem]"}
          >
            {original.receivable.description}
          </CellText>
        ),
      },
    },
    ...(withCustomer
      ? []
      : [
          {
            estimate: 114,
            dropRank: 1,
            only: "table",
            column: {
              id: "posted",
              header: t("dataTable.columns.date"),
              cell: ({ row: { original } }) => (
                <DateText value={format.date(original.receivable.postedDate)} />
              ),
            },
          } satisfies FittedColumn<ReceivableRow>,
        ]),
    {
      estimate: 114,
      column: {
        id: "due",
        header: t("receivables.columns.due"),
        cell: ({ row: { original } }) =>
          original.receivable.dueDate ? (
            <DateText value={format.date(original.receivable.dueDate)} />
          ) : (
            <Text
              accessibilityLabel={t("receivables.list.noDueDate")}
              className="text-[13px] text-muted-foreground"
            >
              —
            </Text>
          ),
      },
    },
    ...(showState
      ? [
          {
            estimate: 90,
            column: {
              id: "state",
              header: t("dataTable.columns.status"),
              cell: ({ row: { original } }) => (
                <ReceivableStateBadge state={original.receivable.state} />
              ),
            },
          } satisfies FittedColumn<ReceivableRow>,
        ]
      : []),
    // The amount still owed is the only figure of a compact record.
    {
      estimate: 96,
      dropRank: withCustomer ? 1 : 2,
      only: "table",
      column: {
        id: "amount",
        header: t("dataTable.columns.amount"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => money(original, original.receivable.originalMinorUnits),
      },
    },
    {
      estimate: 96,
      dropRank: 0,
      only: "table",
      column: {
        id: "paid",
        header: t("receivables.columns.paid"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => money(original, original.receivable.paidMinorUnits),
      },
    },
    {
      estimate: 96,
      column: {
        id: "outstanding",
        header: t("dataTable.columns.outstanding"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => money(original, original.receivable.outstandingMinorUnits),
      },
    },
  ];
  // Each row carries its customer so the table re-renders when a customer read settles.
  const rows = items.map((receivable) => ({
    customer: customerNameFor?.(receivable.customerId),
    receivable,
  }));
  return (
    <View className="min-w-0" onLayout={onLayout}>
      <DataTable
        caption={caption}
        columns={fitColumns(entries, width)}
        data={rows}
        getRowHref={({ receivable }): Href => ({
          pathname: "/operate/receivables/[receivableId]",
          params: { receivableId: receivable.id },
        })}
        getRowId={({ receivable }) => receivable.id}
      />
    </View>
  );
}
