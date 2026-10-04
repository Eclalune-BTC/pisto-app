import type { Category, ProductDetail } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import { Lock, PackageSearch, Plus, Tags, TriangleAlert } from "lucide-react-native";
import { type ReactElement, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { PageHeader } from "@/components/layout/page-header";
import { ContentSkeleton } from "@/components/layout/skeletons";
import { Page } from "@/components/page";
import { OfflineState, StaleNotice } from "@/components/remote-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { SelectField } from "@/components/ui/select-field";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { HeaderActions } from "../cash/header-actions";
import { LoadMoreButton } from "../cash/load-more-button";
import { CategoryName, MissingValue, ProductStatusBadge, StockValue } from "./catalog-cells";
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
  /** Catalog management confirmed by fresh reads. */
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
  state: CatalogCollectionState;
  status: CatalogStatusFilter;
};

const ALL_CATEGORIES = "all";

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
  state,
  status,
}: CatalogScreenProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const columns = useMemo<DataTableColumn<ProductDetail>[]>(() => {
    const names = new Map(categories.map((category) => [category.id, category.name]));
    return [
      {
        id: "product",
        header: t("catalog.list.product"),
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
      {
        id: "category",
        header: t("dataTable.columns.category"),
        cell: ({ row: { original } }) => (
          <CategoryName
            categoryId={original.product.categoryId}
            loading={categoriesLoading}
            names={names}
          />
        ),
      },
      {
        id: "price",
        header: t("dataTable.columns.price"),
        meta: { align: "end", width: 120 },
        cell: ({ row: { original } }) => {
          const price = productPrice(original.product, locale);
          return price ? (
            <Text className="font-ui text-[13px] tabular-nums">{price}</Text>
          ) : (
            <MissingValue label={t("catalog.list.noPrice")} />
          );
        },
      },
      {
        id: "stock",
        header: t("dataTable.columns.stock"),
        meta: { align: "end", width: 240 },
        cell: ({ row: { original } }) => (
          <StockValue product={original.product} stock={original.stock} />
        ),
      },
      ...(status === "all"
        ? [
            {
              id: "status",
              header: t("dataTable.columns.status"),
              meta: { width: 110 },
              cell: ({ row: { original } }) => (
                <ProductStatusBadge status={original.product.status} />
              ),
            } satisfies DataTableColumn<ProductDetail>,
          ]
        : []),
    ];
  }, [categories, categoriesLoading, locale, status, t]);

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

  const filtered = search.trim() !== "" || categoryId !== null || status !== "active";
  const selectedCategory = categoryId ?? ALL_CATEGORIES;
  const categoryOptions = [
    { label: t("catalog.list.allCategories"), value: ALL_CATEGORIES },
    ...categories.map((category) => ({
      label:
        category.status === "archived"
          ? t("catalog.list.archivedCategory", { name: category.name })
          : category.name,
      value: category.id,
    })),
  ];
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
    body = (
      <View
        aria-busy={state.previous}
        className={cn("min-w-0 gap-3", state.previous && "opacity-60")}
      >
        <DataTable
          caption={t("catalog.list.title")}
          columns={columns}
          data={state.items}
          empty={
            filtered ? (
              <EmptyState
                action={
                  onClearFilters ? (
                    <Button
                      label={t("filters.reset")}
                      onPress={onClearFilters}
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
          getRowHref={({ product }) => productHref(product.id)}
          getRowId={({ product }) => product.id}
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
      <View className="min-w-0 gap-3">
        <FilterToolbar label={t("catalog.list.filtersLabel")}>
          <View className="min-w-0 sm:w-72">
            <SearchBox
              label={t("catalog.list.searchLabel")}
              onChange={onSearchChange}
              placeholder={t("catalog.list.searchPlaceholder")}
              value={search}
            />
          </View>
          <View className="min-w-0 sm:w-56">
            <SelectField
              disabled={categoriesLoading}
              label={t("catalog.list.categoryLabel")}
              onChange={(value) => onCategoryChange(value === ALL_CATEGORIES ? null : value)}
              options={categoryOptions}
              placeholder={t("catalog.list.loadingCategories")}
              // Until every category is read, a filtered category may not be among the options yet.
              value={categoriesLoading && categoryId ? null : selectedCategory}
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
        </FilterToolbar>
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
