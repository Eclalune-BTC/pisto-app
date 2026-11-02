import type { Supplier, SupplierListResponse } from "@pisto/contracts";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { type Href, Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { FilterX, Lock, Plus, Store, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";

import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { RouteState } from "@/components/route-state";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { type FittedColumn, fitColumns } from "@/components/ui/fit-columns";
import { Icon } from "@/components/ui/icon";
import { SearchField } from "@/components/ui/search-field";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { capabilityBoundaryState, useCapabilityAccess } from "@/features/customers/access";
import { isPositiveAmount, useRecordFormat } from "@/features/customers/format";
import { MoneyText } from "@/features/customers/money-text";
import { readState } from "@/features/customers/read-state";
import { firstParam } from "@/lib/route-params";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/lib/use-debounced-value";
import { useMeasuredWidth } from "@/lib/use-measured-width";

import { suppliersQueryOptions } from "./queries";
import { SupplierPanel } from "./supplier-detail";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { SupplierPaymentDialog } from "./supplier-payment-dialog";

type SupplierItem = SupplierListResponse["data"]["items"][number];

/** From this window width the selected supplier opens beside the list instead of on its own page. */
const PANEL_MIN_WIDTH = 1024;

function SuppliersTable({
  items,
  onSelect,
  selectedId,
}: {
  items: SupplierItem[];
  /** Opens the supplier beside the list; without it, rows link to the supplier's page. */
  onSelect?: (supplier: SupplierItem) => void;
  selectedId?: string;
}) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const { onLayout, width } = useMeasuredWidth();
  const entries: FittedColumn<SupplierItem>[] = [
    {
      estimate: 240,
      column: {
        id: "supplier",
        header: t("purchases.suppliers.columns.supplier"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <View className="min-w-0 max-w-[15rem]">
            <Text
              className={selectedId === original.id ? "font-ui text-[13px]" : "text-[13px]"}
              numberOfLines={1}
            >
              {original.name}
            </Text>
            {original.notes || original.status === "archived" ? (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {original.status === "archived"
                  ? t("purchases.suppliers.archived")
                  : original.notes}
              </Text>
            ) : null}
          </View>
        ),
      },
    },
    {
      estimate: 180,
      dropRank: 1,
      only: "table",
      column: {
        id: "contact",
        header: t("purchases.suppliers.columns.contact"),
        cell: ({ row: { original } }) => (
          <View className="min-w-0 max-w-[11rem]">
            <Text className="text-[13px]" numberOfLines={1}>
              {original.contactName ?? t("purchases.supplier.notProvided")}
            </Text>
            {original.phone ? (
              <Text className="text-xs text-muted-foreground tabular-nums" numberOfLines={1}>
                {original.phone}
              </Text>
            ) : null}
          </View>
        ),
      },
    },
    {
      estimate: 120,
      dropRank: 2,
      column: {
        id: "lastPurchase",
        header: t("purchases.suppliers.columns.lastPurchase"),
        cell: ({ row: { original } }) => (
          <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
            {original.balance.lastPurchaseLocalDate
              ? format.date(original.balance.lastPurchaseLocalDate)
              : t("purchases.suppliers.noPurchases")}
          </Text>
        ),
      },
    },
    {
      estimate: 110,
      column: {
        id: "owed",
        header: t("purchases.suppliers.columns.owed"),
        meta: { align: "end", figure: true },
        cell: ({ row: { original } }) => (
          <MoneyText
            currency={original.balance.currency}
            digits={original.balance.currencyMinorUnitDigits}
            minorUnits={original.balance.outstandingMinorUnits}
            overdue={isPositiveAmount(original.balance.overdueMinorUnits)}
          />
        ),
      },
    },
  ];
  return (
    <View className="min-w-0" onLayout={onLayout}>
      <DataTable
        caption={t("purchases.suppliers.title")}
        columns={fitColumns(entries, width)}
        data={items}
        getRowHref={
          onSelect
            ? undefined
            : (supplier): Href => ({
                pathname: "/operate/suppliers/[supplierId]",
                params: { supplierId: supplier.id },
              })
        }
        getRowId={(supplier) => supplier.id}
        onRowPress={onSelect}
      />
    </View>
  );
}

export function SuppliersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ balance?: string; supplierId?: string }>();
  const balance = firstParam(params.balance) === "outstanding" ? "outstanding" : "all";
  const selectedId = firstParam(params.supplierId);
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const access = useCapabilityAccess("purchases:read", "purchases:manage");
  const businessId = access.business?.id;
  const enabled = Boolean(access.business && access.canRead);
  const list = useInfiniteQuery({
    ...suppliersQueryOptions(businessId, {
      balance,
      query: query || undefined,
      status: "active",
    }),
    enabled,
    placeholderData: keepPreviousData,
  });
  const [editor, setEditor] = useState<{ open: boolean; supplier: Supplier | null }>({
    open: false,
    supplier: null,
  });
  const [payingSupplier, setPayingSupplier] = useState<string | null>(null);

  const accessState = capabilityBoundaryState(access);
  if (!access.business && accessState === "ready") return <Redirect href="/business" />;
  if (accessState !== "ready" || !access.business) {
    return (
      <RouteState
        kind={accessState === "ready" ? "error" : accessState}
        onRetry={() => void access.refetch()}
      />
    );
  }
  const read = readState([list]);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const canManage = access.hasManagePermission;
  const wide = width >= PANEL_MIN_WIDTH;
  const filtered = balance !== "all" || query.length > 0;
  const selected = wide ? (items.find((item) => item.id === selectedId) ?? items[0]) : undefined;
  const createButton = (variant: "default" | "outline") => (
    <Button
      onPress={() => setEditor({ open: true, supplier: null })}
      size={variant === "outline" ? "sm" : "default"}
      variant={variant}
    >
      <Icon
        as={Plus}
        className={variant === "outline" ? "text-foreground" : "text-primary-foreground"}
        size={16}
      />
      <Text>{t("purchases.suppliers.create")}</Text>
    </Button>
  );

  return (
    <Page>
      <PageHeader
        actions={canManage && read.kind !== "denied" ? createButton("default") : undefined}
        description={t("purchases.suppliers.description")}
        title={t("purchases.suppliers.title")}
      />
      {read.kind === "denied" ? (
        <StatePanel
          description={t("purchases.access.deniedDescription")}
          icon={Lock}
          level={2}
          title={t("purchases.access.deniedTitle")}
        />
      ) : (
        <View className="gap-4 lg:flex-row lg:items-start">
          <View className="min-w-0 flex-1 gap-3">
            <View
              accessibilityLabel={t("purchases.suppliers.filter")}
              className="flex-row flex-wrap items-center gap-2"
              role="toolbar"
            >
              <FilterBar
                label={t("purchases.suppliers.filter")}
                onChange={(next) =>
                  router.setParams({ balance: next === "all" ? undefined : next })
                }
                options={[
                  { label: t("purchases.suppliers.filterAll"), value: "all" },
                  { label: t("purchases.suppliers.filterOutstanding"), value: "outstanding" },
                ]}
                value={balance}
              />
              <View className="min-w-[200px] flex-1">
                <SearchField
                  busy={search.trim() !== query || list.isPlaceholderData}
                  clearLabel={t("relationships.common.clearSearch")}
                  label={t("purchases.suppliers.search")}
                  maxLength={80}
                  onChangeText={setSearch}
                  placeholder={t("purchases.suppliers.searchPlaceholder")}
                  value={search}
                />
              </View>
            </View>
            {read.kind === "ready" && (read.stale || access.isStale) ? (
              <StaleNotice onRetry={() => void list.refetch()} />
            ) : null}
            {read.kind === "loading" ? (
              <ContentSkeleton label={t("purchases.suppliers.loading")} variant="section" />
            ) : read.kind === "offline" ? (
              <OfflineState level={2} />
            ) : read.kind !== "ready" ? (
              <StatePanel
                action={
                  <Button
                    label={t("common.retry")}
                    onPress={() => void list.refetch()}
                    size="sm"
                    variant="outline"
                  />
                }
                description={t("purchases.suppliers.errorDescription")}
                icon={TriangleAlert}
                level={2}
                title={t("purchases.suppliers.errorTitle")}
                tone="destructive"
              />
            ) : items.length === 0 ? (
              filtered ? (
                <EmptyState
                  action={
                    <Button
                      label={t("purchases.suppliers.clearFilters")}
                      onPress={() => {
                        setSearch("");
                        router.setParams({ balance: undefined });
                      }}
                      size="sm"
                      variant="outline"
                    />
                  }
                  description={t("purchases.suppliers.filteredEmptyDescription")}
                  icon={FilterX}
                  title={t("purchases.suppliers.filteredEmptyTitle")}
                />
              ) : (
                <EmptyState
                  action={canManage ? createButton("outline") : undefined}
                  description={t("purchases.suppliers.emptyDescription")}
                  icon={Store}
                  title={t("purchases.suppliers.emptyTitle")}
                />
              )
            ) : (
              <View className="gap-3">
                <SuppliersTable
                  items={items}
                  onSelect={
                    wide ? (supplier) => router.setParams({ supplierId: supplier.id }) : undefined
                  }
                  selectedId={selected?.id}
                />
                {list.hasNextPage ? (
                  <View className="items-center">
                    <Button
                      label={t("common.loadMore")}
                      loading={list.isFetchingNextPage}
                      onPress={() => void list.fetchNextPage()}
                      size="sm"
                      variant="outline"
                    />
                  </View>
                ) : null}
              </View>
            )}
          </View>
          {wide && selected ? (
            <View className="w-[360px] shrink-0">
              <SupplierPanel
                businessId={access.business.id}
                canManage={canManage}
                key={selected.id}
                onEdit={({ supplier }) => setEditor({ open: true, supplier })}
                onRegisterPayment={setPayingSupplier}
                supplierId={selected.id}
              />
            </View>
          ) : null}
        </View>
      )}
      <SupplierFormDialog
        businessId={access.business.id}
        onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
        onSaved={(supplier) => {
          if (wide) router.setParams({ supplierId: supplier.id });
        }}
        open={editor.open}
        supplier={editor.supplier}
      />
      <SupplierPaymentDialog
        onOpenChange={(open) => {
          if (!open) setPayingSupplier(null);
        }}
        open={payingSupplier !== null}
        supplierId={payingSupplier ?? undefined}
      />
    </Page>
  );
}
