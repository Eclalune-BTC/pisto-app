import type { Receivable } from "@pisto/contracts";
import type { Href } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CellText } from "@/components/ui/cell-text";
import { DataTable } from "@/components/ui/data-table";
import { type FittedColumn, fitColumns } from "@/components/ui/fit-columns";
import { Text } from "@/components/ui/text";
import { useRecordFormat } from "@/features/customers/format";
import { MoneyText } from "@/features/customers/money-text";
import { initialsOf } from "@/lib/initials";
import { useMeasuredWidth } from "@/lib/use-measured-width";

import { daysPastDue } from "./receivable-figures";
import { ReceivableStateBadge } from "./receivable-state-badge";

export type CustomerNameCell =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; name: string; phone: string | null };

type ReceivableRow = { customer?: CustomerNameCell; receivable: Receivable };

type ReceivablesTableProps = {
  /** The business-local date overdue days are counted to; without it the column is left out. */
  businessLocalDate?: string;
  caption: string;
  /** Adds the customer as the record name; the receivables of a single customer omit it. */
  customerNameFor?: (customerId: string) => CustomerNameCell;
  items: Receivable[];
  /** Off when every row shares one state, such as a list filtered by state. */
  showState?: boolean;
};

function CustomerCell({ customer }: { customer: CustomerNameCell | undefined }) {
  const { t } = useTranslation();
  if (customer?.kind !== "ready") {
    return (
      <CellText className="text-muted-foreground" maxWidth="max-w-[14rem]">
        {customer?.kind === "loading"
          ? t("receivables.list.customerLoading")
          : t("receivables.list.customerUnavailable")}
      </CellText>
    );
  }
  return (
    <View className="min-w-0 flex-row items-center gap-2.5">
      <Avatar alt={customer.name} className="size-8">
        <AvatarFallback className="bg-muted">
          <Text className="font-ui text-[11px] text-muted-foreground">
            {initialsOf(customer.name)}
          </Text>
        </AvatarFallback>
      </Avatar>
      <View className="min-w-0 shrink">
        <CellText maxWidth="max-w-[14rem]">{customer.name}</CellText>
        {customer.phone ? (
          <Text className="text-xs leading-4 text-muted-foreground tabular-nums" numberOfLines={1}>
            {customer.phone}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function DateText({ value }: { value: string }) {
  return (
    <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
      {value}
    </Text>
  );
}

function LateDays({
  businessLocalDate,
  receivable,
}: {
  businessLocalDate: string;
  receivable: Receivable;
}) {
  const { t } = useTranslation();
  if (receivable.state !== "overdue" || !receivable.dueDate) {
    return (
      <Text
        accessibilityLabel={t("receivables.list.notLate")}
        className="text-[13px] text-muted-foreground"
      >
        —
      </Text>
    );
  }
  const days = daysPastDue(receivable.dueDate, businessLocalDate);
  return (
    <Text className="text-[13px] tabular-nums" numberOfLines={1}>
      {t("receivables.list.lateDays", { count: days })}
    </Text>
  );
}

export function ReceivablesTable({
  businessLocalDate,
  caption,
  customerNameFor,
  items,
  showState = true,
}: ReceivablesTableProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const { onLayout, width } = useMeasuredWidth();
  const withCustomer = customerNameFor !== undefined;
  const entries: FittedColumn<ReceivableRow>[] = [
    ...(withCustomer
      ? [
          {
            estimate: 240,
            column: {
              id: "customer",
              header: t("dataTable.columns.customer"),
              meta: { primary: true },
              cell: ({ row: { original } }) => <CustomerCell customer={original.customer} />,
            },
          } satisfies FittedColumn<ReceivableRow>,
        ]
      : []),
    {
      estimate: withCustomer ? 200 : 280,
      dropRank: withCustomer ? 1 : undefined,
      column: {
        id: "description",
        header: t("receivables.columns.concept"),
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
    {
      estimate: 116,
      dropRank: 2,
      only: "table",
      column: {
        id: "posted",
        header: t("receivables.columns.since"),
        cell: ({ row: { original } }) => (
          <DateText value={format.date(original.receivable.postedDate)} />
        ),
      },
    },
    {
      estimate: 116,
      dropRank: 0,
      only: "table",
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
    ...(businessLocalDate
      ? [
          {
            estimate: 96,
            dropRank: 3,
            only: "table",
            column: {
              id: "late",
              header: t("receivables.columns.late"),
              cell: ({ row: { original } }) => (
                <LateDays businessLocalDate={businessLocalDate} receivable={original.receivable} />
              ),
            },
          } satisfies FittedColumn<ReceivableRow>,
        ]
      : []),
    ...(showState
      ? [
          {
            estimate: 96,
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
      estimate: 104,
      column: {
        id: "outstanding",
        header: t("receivables.columns.balance"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => (
          <MoneyText
            currency={original.receivable.currency}
            digits={original.receivable.currencyMinorUnitDigits}
            minorUnits={original.receivable.outstandingMinorUnits}
          />
        ),
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
