import type { StockListResponse } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import { Boxes, Lock, TriangleAlert } from "lucide-react-native";
import { type ReactElement, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
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
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { SearchField } from "@/components/ui/search-field";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { useMeasuredWidth } from "@/lib/use-measured-width";
import {
  type CategoryCell,
  CategoryName,
  categoryCell,
  MissingValue,
  StockValue,
} from "../catalog/catalog-cells";
import { quantityText } from "../catalog/format";
import { SEARCH_MAX_LENGTH } from "../catalog/search-params";

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
  /** Category choices when the role can read the catalog; null leaves the column out. */
  categories: {
    complete: boolean;
    failed: boolean;
    names: ReadonlyMap<string, string>;
  } | null;
  lowStockOnly: boolean;
  onClearFilters: () => void;
  onLoadMore: () => void;
  onLowStockOnlyChange: (lowStockOnly: boolean) => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  search: string;
  /** The typed search is not applied yet or its results are still loading. */
  searching: boolean;
  state: InventoryCollectionState;
};

/** A stock line with the category name its row shows, so the row redraws when that name arrives. */
type StockRow = { category: CategoryCell | null; item: StockItem };

export function stockHref(productId: string): Href {
  return { pathname: "/operate/inventory/[productId]", params: { productId } };
}

export function newMovementHref(productId: string): Href {
  return { pathname: "/operate/inventory/[productId]/new", params: { productId } };
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
  searching,
  state,
}: InventoryScreenProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const searchRef = useRef<TextInput>(null);
  const { onLayout, width } = useMeasuredWidth();

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

  const columns = fitColumns<StockRow>(
    [
      {
        estimate: 240,
        column: {
          id: "product",
          header: t("inventory.list.product"),
          meta: { primary: true },
          cell: ({ row: { original } }) => (
            <Text className="text-[13px]" numberOfLines={2}>
              {original.item.product.name}
            </Text>
          ),
        },
      },
      {
        estimate: 120,
        dropRank: 0,
        column: {
          id: "sku",
          header: t("dataTable.columns.sku"),
          cell: ({ row: { original } }) =>
            original.item.product.sku ? (
              <CellText className="text-muted-foreground" maxWidth="max-w-[8rem]">
                {original.item.product.sku}
              </CellText>
            ) : (
              <MissingValue label={t("catalog.detail.noSku")} />
            ),
        },
      },
      ...(categories
        ? [
            {
              estimate: 150,
              dropRank: 1,
              column: {
                id: "category",
                header: t("dataTable.columns.category"),
                cell: ({ row: { original } }) =>
                  original.category ? <CategoryName cell={original.category} /> : null,
              },
            } satisfies FittedColumn<StockRow>,
          ]
        : []),
      {
        estimate: 170,
        column: {
          id: "onHand",
          header: t("dataTable.columns.stock"),
          meta: { align: "end", figure: true, width: 170 },
          cell: ({ row: { original } }) => (
            <StockValue product={original.item.product} stock={original.item.stock} />
          ),
        },
      },
      {
        estimate: 130,
        column: {
          id: "threshold",
          header: t("dataTable.columns.minimum"),
          meta: { align: "end", width: 130 },
          cell: ({ row: { original } }) =>
            original.item.stock.lowStockThresholdMinorUnits === null ? (
              <MissingValue label={t("inventory.list.noThreshold")} />
            ) : (
              <Text className="text-[13px] text-muted-foreground tabular-nums" numberOfLines={1}>
                {quantityText(t, locale, {
                  minorUnits: original.item.stock.lowStockThresholdMinorUnits,
                  precision: original.item.stock.quantityPrecision,
                  unitKind: original.item.product.unitKind,
                })}
              </Text>
            ),
        },
      },
    ],
    width,
  );
  const clearFilters = () => {
    onClearFilters();
    searchRef.current?.focus();
  };

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
      <Button label={t("filters.reset")} onPress={clearFilters} size="sm" variant="outline" />
    );
    const rows = state.items.map((item) => ({
      category: categories ? categoryCell(item.product.categoryId, categories) : null,
      item,
    }));
    body = (
      <View
        aria-busy={state.previous}
        className={cn("min-w-0 gap-3", state.previous && "opacity-60")}
      >
        <DataTable
          caption={t("inventory.list.title")}
          columns={columns}
          data={rows}
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
          getRowHref={({ item }) => stockHref(item.product.id)}
          getRowId={({ item }) => item.product.id}
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
      <View className="min-w-0 gap-3" onLayout={onLayout}>
        <View
          accessibilityLabel={t("inventory.list.filtersLabel")}
          className="min-w-0 flex-row flex-wrap items-center gap-2"
          role="toolbar"
        >
          <View className="min-w-0 grow basis-[220px] sm:max-w-[320px]">
            <SearchField
              maxLength={SEARCH_MAX_LENGTH}
              busy={searching}
              clearLabel={t("inventory.list.clearSearch")}
              label={t("inventory.list.searchLabel")}
              onChangeText={onSearchChange}
              placeholder={t("inventory.list.searchPlaceholder")}
              ref={searchRef}
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
        </View>
        {body}
      </View>
    </Page>
  );
}
