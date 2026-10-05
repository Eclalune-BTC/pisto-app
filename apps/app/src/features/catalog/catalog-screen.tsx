import type { Category, ProductDetail } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import { Lock, PackageSearch, Plus, Tags, TriangleAlert } from "lucide-react-native";
import { type ReactElement, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type TextInput, View } from "react-native";
import { HeaderActions } from "@/components/layout/header-actions";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CellText } from "@/components/ui/cell-text";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { type FittedColumn, fitColumns } from "@/components/ui/fit-columns";
import { LoadMoreButton } from "@/components/ui/load-more-button";
import { SelectField } from "@/components/ui/select-field";
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
  ProductStatusBadge,
  StockValue,
} from "./catalog-cells";
import { productPrice } from "./format";
import type { CatalogStatusFilter } from "./queries";
import { SearchBox } from "./search-box";

export type CatalogCollectionState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "denied" }
  | { status: "error" }
  | {
      status: "ready";
      hasNextPage: boolean;
      items: ProductDetail[];
      loadingMore: boolean;
      /** Results of the previous search or filter, kept on screen while the new ones load. */
      previous?: boolean;
      /** The last refresh failed or paused; `refreshing` while it is tried again. */
      stale?: boolean;
      refreshing?: boolean;
    };

type CatalogScreenProps = {
  /** The role may manage the catalog; it does not depend on the state of the list read. */
  canManage: boolean;
  /** Every category of the business, for the filter and the category column. */
  categories: Category[];
  categoriesError: boolean;
  /** Category choices are still being read, so a category name may not be known yet. */
  categoriesLoading: boolean;
  categoryId: string | null;
  onCategoryChange: (categoryId: string | null) => void;
  /** Clears the search and both filters from a filtered empty result. */
  onClearFilters?: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onRetryCategories: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: CatalogStatusFilter) => void;
  search: string;
  /** The typed search is not applied yet or its results are still loading. */
  searching?: boolean;
  state: CatalogCollectionState;
  status: CatalogStatusFilter;
};

const ALL_CATEGORIES = "all";

/** A product with the category name its row shows, so the row redraws when that name arrives. */
type CatalogRow = { category: CategoryCell; detail: ProductDetail };

export function productHref(productId: string): Href {
  return { pathname: "/operate/catalog/[productId]", params: { productId } };
}

export function CatalogScreen({
  canManage,
  categories,
  categoriesError,
  categoriesLoading,
  categoryId,
  onCategoryChange,
  onClearFilters,
  onLoadMore,
  onRetry,
  onRetryCategories,
  onSearchChange,
  onStatusChange,
  search,
  searching = false,
  state,
  status,
}: CatalogScreenProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const searchRef = useRef<TextInput>(null);
  const { onLayout, width } = useMeasuredWidth();

  if (state.status === "denied") {
    return (
      <Page>
        <StatePanel
          description={t("catalog.list.deniedDescription")}
          icon={Lock}
          level={1}
          title={t("catalog.list.deniedTitle")}
        />
      </Page>
    );
  }

  const columns = fitColumns<CatalogRow>(
    [
      {
        estimate: 240,
        column: {
          id: "product",
          header: t("catalog.list.product"),
          meta: { primary: true },
          cell: ({ row: { original } }) => (
            <Text className="text-[13px]" numberOfLines={2}>
              {original.detail.product.name}
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
            original.detail.product.sku ? (
              <CellText className="text-muted-foreground" maxWidth="max-w-[8rem]">
                {original.detail.product.sku}
              </CellText>
            ) : (
              <MissingValue label={t("catalog.detail.noSku")} />
            ),
        },
      },
      {
        estimate: 150,
        dropRank: 1,
        column: {
          id: "category",
          header: t("dataTable.columns.category"),
          cell: ({ row: { original } }) => <CategoryName cell={original.category} />,
        },
      },
      {
        estimate: 110,
        column: {
          id: "price",
          header: t("dataTable.columns.price"),
          meta: { align: "end", width: 110 },
          cell: ({ row: { original } }) => {
            const price = productPrice(original.detail.product, locale);
            return price ? (
              <Text className="font-ui text-[13px] tabular-nums" numberOfLines={1}>
                {price}
              </Text>
            ) : (
              <MissingValue label={t("catalog.list.noPrice")} />
            );
          },
        },
      },
      {
        estimate: 170,
        column: {
          id: "stock",
          header: t("dataTable.columns.stock"),
          meta: { align: "end", width: 170 },
          cell: ({ row: { original } }) => (
            <StockValue product={original.detail.product} stock={original.detail.stock} />
          ),
        },
      },
      // A filter on one status makes the column identical on every row.
      ...(status === "all"
        ? [
            {
              estimate: 110,
              column: {
                id: "status",
                header: t("dataTable.columns.status"),
                meta: { width: 110 },
                cell: ({ row: { original } }) => (
                  <ProductStatusBadge status={original.detail.product.status} />
                ),
              },
            } satisfies FittedColumn<CatalogRow>,
          ]
        : []),
    ],
    width,
  );
  const names = new Map(categories.map((category) => [category.id, category.name]));
  const choices = { complete: !categoriesLoading, failed: categoriesError, names };
  const filtered = search.trim() !== "" || categoryId !== null || status !== "active";
  // Active categories come first; an archived one is still offered so its products can be found.
  const categoryOptions = [
    { label: t("catalog.list.allCategories"), value: ALL_CATEGORIES },
    ...[
      ...categories.filter((category) => category.status === "active"),
      ...categories.filter((category) => category.status === "archived"),
    ].map((category) => ({
      label:
        category.status === "archived"
          ? t("catalog.list.archivedCategory", { name: category.name })
          : category.name,
      value: category.id,
    })),
  ];
  const clearFilters = onClearFilters
    ? () => {
        onClearFilters();
        searchRef.current?.focus();
      }
    : undefined;

  let body: ReactElement;
  if (state.status === "loading") {
    body = <ContentSkeleton label={t("catalog.list.loading")} variant="section" />;
  } else if (state.status === "offline") {
    body = <OfflineState level={2} />;
  } else if (state.status === "error") {
    body = (
      <StatePanel
        action={<Button label={t("common.retry")} onPress={onRetry} size="sm" variant="outline" />}
        description={t("catalog.list.unavailableDescription")}
        icon={TriangleAlert}
        level={2}
        title={t("catalog.list.unavailableTitle")}
        tone="destructive"
      />
    );
  } else {
    const rows = state.items.map((detail) => ({
      category: categoryCell(detail.product.categoryId, choices),
      detail,
    }));
    body = (
      <View
        aria-busy={state.previous}
        className={cn("min-w-0 gap-3", state.previous && "opacity-60")}
      >
        <DataTable
          caption={t("catalog.list.title")}
          columns={columns}
          data={rows}
          empty={
            filtered ? (
              <EmptyState
                action={
                  clearFilters ? (
                    <Button
                      label={t("filters.reset")}
                      onPress={clearFilters}
                      size="sm"
                      variant="outline"
                    />
                  ) : undefined
                }
                description={t("catalog.list.emptyFilteredDescription")}
                icon={PackageSearch}
                title={t("catalog.list.emptyFilteredTitle")}
              />
            ) : (
              <EmptyState
                action={canManage ? <NewProductLink /> : undefined}
                description={t("catalog.list.emptyDescription")}
                icon={PackageSearch}
                title={t("catalog.list.emptyTitle")}
              />
            )
          }
          getRowHref={({ detail }) => productHref(detail.product.id)}
          getRowId={({ detail }) => detail.product.id}
        />
        {state.previous ? null : (
          <LoadMoreButton
            page={{
              hasMore: state.hasNextPage,
              loadingMore: state.loadingMore,
              onLoadMore,
            }}
          />
        )}
      </View>
    );
  }

  return (
    <Page>
      <PageHeader
        actions={
          <HeaderActions
            menuLabel={t("catalog.list.moreActions")}
            primary={
              canManage
                ? {
                    href: "/operate/catalog/new",
                    icon: Plus,
                    label: t("catalog.list.createProduct"),
                  }
                : undefined
            }
            secondary={[
              {
                href: "/operate/catalog/categories",
                icon: Tags,
                label: t("catalog.list.manageCategories"),
              },
            ]}
          />
        }
        description={t("catalog.list.description")}
        title={t("catalog.list.title")}
      />
      {state.status === "ready" && state.stale ? (
        <StaleNotice loading={state.refreshing} onRetry={onRetry} />
      ) : null}
      <View className="min-w-0 gap-3" onLayout={onLayout}>
        <View
          accessibilityLabel={t("catalog.list.filtersLabel")}
          className="min-w-0 flex-row flex-wrap items-end gap-2"
          role="toolbar"
        >
          <View className="min-w-0 grow basis-[220px] sm:max-w-[320px]">
            <SearchBox
              busy={searching}
              clearLabel={t("catalog.list.clearSearch")}
              label={t("catalog.list.searchLabel")}
              onChange={onSearchChange}
              placeholder={t("catalog.list.searchPlaceholder")}
              ref={searchRef}
              value={search}
            />
          </View>
          <View className="min-w-0 grow basis-[200px] sm:max-w-[240px]">
            <SelectField
              disabled={categoriesLoading}
              label={t("catalog.list.categoryLabel")}
              onChange={(value) => onCategoryChange(value === ALL_CATEGORIES ? null : value)}
              options={categoryOptions}
              placeholder={t("catalog.list.loadingCategories")}
              // Until every category is read, a filtered category may not be among the options yet.
              value={categoriesLoading && categoryId ? null : (categoryId ?? ALL_CATEGORIES)}
            />
          </View>
          <FilterBar
            label={t("catalog.list.statusLabel")}
            onChange={onStatusChange}
            options={(["active", "archived", "all"] as const).map((value) => ({
              label: t(`catalog.list.statuses.${value}`),
              value,
            }))}
            value={status}
          />
        </View>
        {categoriesError ? (
          <Alert
            action={
              <Button
                label={t("common.retry")}
                onPress={onRetryCategories}
                size="sm"
                variant="outline"
              />
            }
            icon={TriangleAlert}
            variant="warning"
          >
            <AlertDescription>{t("catalog.list.categoriesUnavailable")}</AlertDescription>
          </Alert>
        ) : null}
        {body}
      </View>
    </Page>
  );
}

function NewProductLink() {
  const { t } = useTranslation();
  return (
    <Link asChild href="/operate/catalog/new">
      <Button accessibilityRole="link" size="sm">
        <Text>{t("catalog.list.createProduct")}</Text>
      </Button>
    </Link>
  );
}
