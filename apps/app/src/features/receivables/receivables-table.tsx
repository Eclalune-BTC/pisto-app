import type { Receivable } from "@pisto/contracts";
import type { Href } from "expo-router";
import { useTranslation } from "react-i18next";

import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Text } from "@/components/ui/text";
import { useRecordFormat } from "@/features/customers/format";

import { ReceivableStateBadge } from "./receivable-state-badge";

export type CustomerNameCell =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; name: string };

type ReceivableRow = { customer?: CustomerNameCell; receivable: Receivable };

type ReceivablesTableProps = {
  caption: string;
  /** Adds the customer as the record name; a customer's own history omits it. */
  customerNameFor?: (customerId: string) => CustomerNameCell;
  items: Receivable[];
};

function CustomerName({ customer }: { customer: CustomerNameCell | undefined }) {
  const { t } = useTranslation();
  return customer?.kind === "ready" ? (
    <Text className="text-[13px]" numberOfLines={1}>
      {customer.name}
    </Text>
  ) : (
    <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
      {customer?.kind === "loading"
        ? t("receivables.list.customerLoading")
        : t("receivables.list.customerUnavailable")}
    </Text>
  );
}

export function ReceivablesTable({ caption, customerNameFor, items }: ReceivablesTableProps) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const withCustomer = customerNameFor !== undefined;
  const money = ({ receivable }: ReceivableRow, minorUnits: string) => (
    <Text className="font-ui text-[13px] tabular-nums">
      {format.money(minorUnits, receivable.currency, receivable.currencyMinorUnitDigits)}
    </Text>
  );
  const columns: DataTableColumn<ReceivableRow>[] = [
    ...(withCustomer
      ? [
          {
            id: "customer",
            header: t("dataTable.columns.customer"),
            meta: { primary: true },
            cell: ({ row: { original } }) => <CustomerName customer={original.customer} />,
          } satisfies DataTableColumn<ReceivableRow>,
        ]
      : []),
    {
      id: "description",
      header: t("dataTable.columns.description"),
      meta: withCustomer ? undefined : { primary: true },
      cell: ({ row: { original } }) => (
        <Text
          className={withCustomer ? "text-[13px] text-muted-foreground" : "text-[13px]"}
          numberOfLines={1}
        >
          {original.receivable.description}
        </Text>
      ),
    },
    ...(withCustomer
      ? []
      : [
          {
            id: "posted",
            header: t("dataTable.columns.date"),
            meta: { hideOnCompact: true },
            cell: ({ row: { original } }) => (
              <Text className="text-[13px] text-muted-foreground tabular-nums">
                {format.date(original.receivable.postedDate)}
              </Text>
            ),
          } satisfies DataTableColumn<ReceivableRow>,
        ]),
    {
      id: "due",
      header: t("receivables.columns.due"),
      cell: ({ row: { original } }) =>
        original.receivable.dueDate ? (
          <Text className="text-[13px] text-muted-foreground tabular-nums">
            {format.date(original.receivable.dueDate)}
          </Text>
        ) : (
          <Text
            accessibilityLabel={t("receivables.list.noDueDate")}
            className="text-[13px] text-muted-foreground"
          >
            —
          </Text>
        ),
    },
    {
      id: "state",
      header: t("dataTable.columns.status"),
      cell: ({ row: { original } }) => <ReceivableStateBadge state={original.receivable.state} />,
    },
    {
      id: "amount",
      header: t("dataTable.columns.amount"),
      meta: { align: "end" },
      cell: ({ row: { original } }) => money(original, original.receivable.originalMinorUnits),
    },
    {
      id: "paid",
      header: t("receivables.columns.paid"),
      meta: { align: "end", hideOnCompact: true },
      cell: ({ row: { original } }) => money(original, original.receivable.paidMinorUnits),
    },
    {
      id: "outstanding",
      header: t("dataTable.columns.outstanding"),
      meta: { align: "end" },
      cell: ({ row: { original } }) => money(original, original.receivable.outstandingMinorUnits),
    },
  ];
  // Each row carries its customer so the table re-renders when a customer read settles.
  const rows = items.map((receivable) => ({
    customer: customerNameFor?.(receivable.customerId),
    receivable,
  }));
  return (
    <DataTable
      caption={caption}
      columns={columns}
      data={rows}
      getRowHref={({ receivable }): Href => ({
        pathname: "/operate/receivables/[receivableId]",
        params: { receivableId: receivable.id },
      })}
      getRowId={({ receivable }) => receivable.id}
    />
  );
}
