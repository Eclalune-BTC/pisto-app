import type { StockListResponse } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import { Boxes, Lock, TriangleAlert } from "lucide-react-native";
import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { LoadMoreButton } from "../cash/load-more-button";
import { CategoryName, MissingValue, StockValue } from "../catalog/catalog-cells";
import { quantityText } from "../catalog/format";
import { SearchBox } from "../catalog/search-box";

export type StockItem = StockListResponse["data"]["items"][number];

export type InventoryCollectionState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "denied" }
  | { status: "error" }
  | {
      status: "ready";
      hasNextPage: boolean;
      items: StockItem[];
      loadingMore: boolean;
      /** Results of the previous search or filter, kept on screen while the new ones load. */
      previous: boolean;
      refreshing: boolean;
      stale: boolean;
    };

type InventoryScreenProps = {
  /** Category names, when the role can read the catalog; null hides the column. */
  categories: { loading: boolean; names: ReadonlyMap<string, string> } | null;
  lowStockOnly: boolean;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onLowStockOnlyChange: (lowStockOnly: boolean) => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  search: string;
  state: InventoryCollectionState;
};

export function stockHref(productId: string): Href {
  return { pathname: "/operate/inventory/[productId]", params: { productId } };
}

export function InventoryScreen({
  categories,
  lowStockOnly,
  onClearFilters,
  onLoadMore,
  onLowStockOnlyChange,
  onRetry,
  onSearchChange,
  search,
  state,
}: InventoryScreenProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const columns = useMemo<DataTableColumn<StockItem>[]>(
    () => [
      {
        id: "product",
        header: t("inventory.list.product"),
        meta: { primary: true },
        cell: ({ row: { original } }) => (
          <Text className="text-[13px]" numberOfLines={2}>
            {original.product.name}
          </Text>
        ),
      },
      {
        id: "sku",
        header: t("dataTable.columns.sku"),
        cell: ({ row: { original } }) =>
          original.product.sku ? (
            <Text className="text-[13px] text-muted-foreground" numberOfLines={1}>
              {original.product.sku}
            </Text>
          ) : (
            <MissingValue label={t("catalog.detail.noSku")} />
          ),
      },
      ...(categories
        ? [
            {
              id: "category",
              header: t("dataTable.columns.category"),
              cell: ({ row: { original } }) => (
                <CategoryName
                  categoryId={original.product.categoryId}
                  loading={categories.loading}
                  names={categories.names}
                />
              ),
            } satisfies DataTableColumn<StockItem>,
          ]
        : []),
      {
        id: "onHand",
        header: t("inventory.list.onHand"),
        meta: { align: "end", figure: true, width: 240 },
        cell: ({ row: { original } }) => (
          <StockValue product={original.product} stock={original.stock} />
        ),
      },
      {
        id: "threshold",
        header: t("dataTable.columns.minimum"),
        meta: { align: "end", width: 140 },
        cell: ({ row: { original } }) =>
          original.stock.lowStockThresholdMinorUnits === null ? (
            <MissingValue label={t("inventory.list.noThreshold")} />
          ) : (
            <Text className="text-[13px] text-muted-foreground tabular-nums">
              {quantityText(t, locale, {
                minorUnits: original.stock.lowStockThresholdMinorUnits,
                precision: original.stock.quantityPrecision,
                unitKind: original.product.unitKind,
              })}
            </Text>
          ),
      },
    ],
    [categories, locale, t],
  );

  if (state.status === "denied") {
    return (
      <Page>
        <StatePanel
          description={t("inventory.list.deniedDescription")}
          icon={Lock}
          level={1}
          title={t("inventory.list.deniedTitle")}
        />
      </Page>
    );
  }

  let body: ReactElement;
  if (state.status === "loading") {
    body = <ContentSkeleton label={t("inventory.list.loading")} variant="section" />;
  } else if (state.status === "offline") {
    body = <OfflineState level={2} />;
  } else if (state.status === "error") {
    body = (
      <StatePanel
        action={<Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />}
        description={t("inventory.list.unavailableDescription")}
        icon={TriangleAlert}
        level={2}
        title={t("inventory.list.unavailableTitle")}
        tone="destructive"
      />
    );
  } else {
    const clear = (
      <Button label={t("filters.reset")} onPress={onClearFilters} size="sm" variant="outline" />
    );
    body = (
      <View
        aria-busy={state.previous}
        className={cn("min-w-0 gap-3", state.previous && "opacity-60")}
      >
        <DataTable
          caption={t("inventory.list.title")}
          columns={columns}
          data={state.items}
          empty={
            search.trim() ? (
              <EmptyState
                action={clear}
                description={t("inventory.list.emptyFilteredDescription")}
                icon={Boxes}
                title={t("inventory.list.emptyFilteredTitle")}
              />
            ) : lowStockOnly ? (
              <EmptyState
                action={clear}
                description={t("inventory.list.emptyLowDescription")}
                icon={Boxes}
                title={t("inventory.list.emptyLowTitle")}
              />
            ) : (
              <EmptyState
                action={
                  categories ? (
                    <Link asChild href="/operate/catalog">
                      <Button accessibilityRole="link" size="sm" variant="outline">
                        <Text>{t("inventory.list.goToCatalog")}</Text>
                      </Button>
                    </Link>
                  ) : undefined
                }
                description={t("inventory.list.emptyDescription")}
                icon={Boxes}
                title={t("inventory.list.emptyTitle")}
              />
            )
          }
          getRowHref={({ product }) => stockHref(product.id)}
          getRowId={({ product }) => product.id}
        />
        {state.previous ? null : (
          <LoadMoreButton
            page={{ hasMore: state.hasNextPage, loadingMore: state.loadingMore, onLoadMore }}
          />
        )}
      </View>
    );
  }

  return (
    <Page>
      <PageHeader description={t("inventory.list.description")} title={t("inventory.list.title")} />
      {state.status === "ready" && state.stale ? (
        <StaleNotice loading={state.refreshing} onRetry={onRetry} />
      ) : null}
      <View className="min-w-0 gap-3">
        <FilterToolbar label={t("inventory.list.filtersLabel")}>
          <View className="min-w-0 sm:w-72">
            <SearchBox
              label={t("inventory.list.searchLabel")}
              onChange={onSearchChange}
              placeholder={t("inventory.list.searchPlaceholder")}
              value={search}
            />
          </View>
          <FilterBar
            label={t("inventory.list.filterLabel")}
            onChange={(value) => onLowStockOnlyChange(value === "low")}
            options={[
              { label: t("inventory.list.filters.all"), value: "all" },
              { label: t("inventory.list.filters.low"), value: "low" },
            ]}
            value={lowStockOnly ? "low" : "all"}
          />
        </FilterToolbar>
        {body}
      </View>
    </Page>
  );
}
