import type { Customer } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import { Lock, Plus, SearchX, TriangleAlert, Users } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { CellText } from "@/components/ui/cell-text";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { type FittedColumn, fitColumns } from "@/components/ui/fit-columns";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import { CustomerStatusBadge } from "./customer-status-badge";
import { CUSTOMER_SEARCH_MAX_LENGTH, type CustomerStatusFilter } from "./list-params";
import { MoneyText } from "./money-text";
import { SearchField } from "./search-field";
import type { CustomerBalanceCell, CustomersLoadState } from "./types";

type CustomersScreenProps = {
  balanceFor: (customerId: string) => CustomerBalanceCell;
  /** Permission to create customers; it does not depend on the state of the list read. */
  canCreate: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onSearchChange: (query: string) => void;
  onStatusChange: (status: CustomerStatusFilter) => void;
  /** The search applied to the current result; `search` is what the input holds right now. */
  query: string;
  search: string;
  /** The typed search has not been applied yet or its result is still being read. */
  searching: boolean;
  state: CustomersLoadState;
  status: CustomerStatusFilter;
};

const NEW_CUSTOMER: Href = "/operate/customers/new";

type CustomerRow = { balance: CustomerBalanceCell; customer: Customer };

function BalanceAmount({
  cell,
  overdue = false,
}: {
  cell: CustomerBalanceCell;
  overdue?: boolean;
}) {
  const { t } = useTranslation();
  if (cell.kind === "loading") return <Skeleton className="h-3 w-16" />;
  if (cell.kind === "unavailable") {
    return (
      <Text className="text-[13px] text-muted-foreground">
        {t("customers.list.balanceUnavailable")}
      </Text>
    );
  }
  const { balance } = cell;
  return (
    <MoneyText
      currency={balance.currency}
      digits={balance.currencyMinorUnitDigits}
      minorUnits={overdue ? balance.overdueMinorUnits : balance.outstandingMinorUnits}
      overdue={overdue}
    />
  );
}

function ContactValue({ maxWidth, value }: { maxWidth: string; value: string | null }) {
  const { t } = useTranslation();
  return value ? (
    <CellText className="text-muted-foreground" maxWidth={maxWidth}>
      {value}
    </CellText>
  ) : (
    <Text
      accessibilityLabel={t("customers.list.noContact")}
      className="text-[13px] text-muted-foreground"
    >
      —
    </Text>
  );
}

function NewCustomerLink({ variant = "default" }: { variant?: "default" | "outline" }) {
  const { t } = useTranslation();
  return (
    <Link asChild href={NEW_CUSTOMER}>
      <Button
        accessibilityRole="link"
        size={variant === "outline" ? "sm" : "default"}
        variant={variant}
      >
        <Icon
          as={Plus}
          className={variant === "outline" ? "text-foreground" : "text-primary-foreground"}
          size={16}
        />
        <Text>{t("customers.list.create")}</Text>
      </Button>
    </Link>
  );
}

export function CustomersScreen({
  balanceFor,
  canCreate,
  onLoadMore,
  onRetry,
  onSearchChange,
  onStatusChange,
  query,
  search,
  searching,
  state,
  status,
}: CustomersScreenProps) {
  const { t } = useTranslation();
  const { onLayout, width } = useMeasuredWidth();
  const entries: FittedColumn<CustomerRow>[] = [
    {
      estimate: 248,
      column: {
        id: "name",
        header: t("dataTable.columns.name"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <CellText maxWidth="max-w-[14rem]">{original.customer.name}</CellText>
        ),
      },
    },
    {
      estimate: 134,
      dropRank: 1,
      column: {
        id: "phone",
        header: t("dataTable.columns.phone"),
        cell: ({ row: { original } }) => (
          <ContactValue maxWidth="max-w-[9rem]" value={original.customer.phone} />
        ),
      },
    },
    {
      estimate: 248,
      dropRank: 0,
      only: "table",
      column: {
        id: "email",
        header: t("dataTable.columns.email"),
        cell: ({ row: { original } }) => (
          <ContactValue maxWidth="max-w-[14rem]" value={original.customer.email} />
        ),
      },
    },
    // A filter on one status makes the column identical on every row.
    ...(status === "all"
      ? [
          {
            estimate: 104,
            column: {
              id: "status",
              header: t("dataTable.columns.status"),
              cell: ({ row: { original } }) => (
                <CustomerStatusBadge status={original.customer.status} />
              ),
            },
          } satisfies FittedColumn<CustomerRow>,
        ]
      : []),
    {
      estimate: 96,
      column: {
        id: "outstanding",
        header: t("dataTable.columns.outstanding"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => <BalanceAmount cell={original.balance} />,
      },
    },
    {
      estimate: 96,
      column: {
        id: "overdue",
        header: t("customers.list.overdueColumn"),
        meta: { align: "end" },
        cell: ({ row: { original } }) => <BalanceAmount cell={original.balance} overdue />,
      },
    },
  ];
  const read = state.kind === "empty" || state.kind === "ready";
  // Each row carries its balance so the table re-renders when a balance read settles.
  const rows: CustomerRow[] =
    state.kind === "ready"
      ? state.items.map((customer) => ({ balance: balanceFor(customer.id), customer }))
      : [];

  return (
    <Page>
      <PageHeader
        actions={canCreate && state.kind !== "denied" ? <NewCustomerLink /> : undefined}
        description={t("customers.list.description")}
        title={t("customers.list.title")}
      />
      {state.kind === "denied" ? (
        <StatePanel
          description={t("relationships.access.deniedDescription")}
          icon={Lock}
          level={2}
          title={t("customers.list.deniedTitle")}
        />
      ) : (
        <>
          <View
            accessibilityLabel={t("customers.list.filters")}
            className="flex-row flex-wrap items-center gap-2"
            role="toolbar"
          >
            <View className="min-w-0 grow basis-[220px] sm:max-w-[340px]">
              <SearchField
                busy={searching}
                clearLabel={t("relationships.common.clearSearch")}
                label={t("customers.list.searchLabel")}
                maxLength={CUSTOMER_SEARCH_MAX_LENGTH}
                onChangeText={onSearchChange}
                placeholder={t("customers.list.searchPlaceholder")}
                value={search}
              />
            </View>
            <FilterBar
              label={t("customers.list.statusFilter")}
              onChange={onStatusChange}
              options={[
                { value: "active", label: t("customers.list.filterActive") },
                { value: "archived", label: t("customers.list.filterArchived") },
                { value: "all", label: t("customers.list.filterAll") },
              ]}
              value={status}
            />
          </View>
          {read && state.stale ? <StaleNotice onRetry={onRetry} /> : null}
          {state.kind === "loading" ? (
            <ContentSkeleton label={t("customers.list.loading")} variant="section" />
          ) : state.kind === "offline" ? (
            <OfflineState level={2} />
          ) : state.kind === "error" ? (
            <StatePanel
              action={
                <Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />
              }
              description={t("customers.list.errorDescription")}
              icon={TriangleAlert}
              level={2}
              title={t("customers.list.errorTitle")}
              tone="destructive"
            />
          ) : state.kind === "empty" ? (
            query ? (
              <EmptyState
                action={
                  <Button
                    label={t("relationships.common.clearSearch")}
                    onPress={() => onSearchChange("")}
                    size="sm"
                    variant="outline"
                  />
                }
                description={t("customers.list.searchEmptyDescription")}
                icon={SearchX}
                title={t("customers.list.searchEmptyTitle")}
              />
            ) : status === "active" ? (
              <EmptyState
                action={canCreate ? <NewCustomerLink variant="outline" /> : undefined}
                description={t("customers.list.emptyDescription")}
                icon={Users}
                title={t("customers.list.emptyTitle")}
              />
            ) : (
              <EmptyState
                description={t("customers.list.statusEmptyDescription")}
                icon={Users}
                title={t("customers.list.statusEmptyTitle")}
              />
            )
          ) : (
            <View className="gap-3" onLayout={onLayout}>
              <DataTable
                caption={t("customers.list.title")}
                columns={fitColumns(entries, width)}
                data={rows}
                getRowHref={({ customer }): Href => ({
                  pathname: "/operate/customers/[customerId]",
                  params: { customerId: customer.id },
                })}
                getRowId={({ customer }) => customer.id}
              />
              {state.nextCursor ? (
                <View className="items-center">
                  <Button
                    label={t("common.loadMore")}
                    loading={state.loadingMore}
                    onPress={onLoadMore}
                    size="sm"
                    variant="outline"
                  />
                </View>
              ) : null}
            </View>
          )}
        </>
      )}
    </Page>
  );
}
