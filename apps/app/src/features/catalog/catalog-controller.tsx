import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { RouteState } from "@/components/route-state";
import { flattenPages } from "@/lib/pages";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import type { RouteParam } from "@/lib/route-params";
import { type CatalogCollectionState, CatalogScreen } from "./catalog-screen";
import {
  categoryChoices,
  type ProductListFilters,
  productsInfiniteOptions,
  useCategoryChoices,
} from "./queries";
import {
  parseCategoryParam,
  parseSearchParam,
  parseStatusParam,
  statusParam,
  useSearchInput,
} from "./search-params";
import { hasStaleRead, readState } from "./state";

type CatalogSearchParams = { category?: RouteParam; q?: RouteParam; status?: RouteParam };

export default function CatalogController() {
  const { t } = useTranslation();
  const router = useRouter();
  // Filters live in the URL so that returning from a product restores the same list.
  const params = useLocalSearchParams<CatalogSearchParams>();
  const filters: ProductListFilters = {
    categoryId: parseCategoryParam(params.category),
    search: parseSearchParam(params.q),
    status: parseStatusParam(params.status),
  };
  const [search, setSearch] = useSearchInput(filters.search, (q) => router.setParams({ q }));
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = access === "denied" ? undefined : getActiveBusiness(businesses.data);
  const permissions = business?.access.permissions ?? [];
  const canRead = permissions.includes("catalog:read");
  const readableBusinessId = canRead ? business?.id : undefined;
  const products = useInfiniteQuery(productsInfiniteOptions(readableBusinessId, filters));
  const categories = useCategoryChoices(readableBusinessId);

  if (access === "offline") return <RouteState kind="offline" />;
  if (access === "loading") return <RouteState kind="loading" />;
  if (access === "error" || access === "notFound") {
    return <RouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  if (!business || !canRead) {
    return (
      <RouteState
        description={t("catalog.list.deniedDescription")}
        kind="denied"
        title={t("catalog.list.deniedTitle")}
      />
    );
  }

  const stale = hasStaleRead([businesses, products]);
  // A rejected category read is a rejection of the catalog too; its cached names must go. Rows
  // kept from the previous filter must not stand in for a filter that cannot load offline.
  const productsRead = hasDeniedRead([categories])
    ? "denied"
    : products.isPlaceholderData && products.fetchStatus === "paused"
      ? "offline"
      : readState([products]);
  let state: CatalogCollectionState;
  if (productsRead === "ready") {
    state = {
      status: "ready",
      hasNextPage: products.hasNextPage,
      items: flattenPages(products.data),
      loadingMore: products.isFetchingNextPage,
      previous: products.isPlaceholderData,
      refreshing: products.isFetching,
      stale,
    };
  } else if (productsRead === "notFound") {
    state = { status: "error" };
  } else {
    state = { status: productsRead };
  }
  const choices = categoryChoices(categories);
  const refresh = () => {
    void businesses.refetch();
    void products.refetch();
  };

  return (
    <CatalogScreen
      canManage={permissions.includes("catalog:manage")}
      categories={choices.items}
      categoriesError={categories.isError}
      categoriesLoading={!choices.complete && !categories.isError}
      categoryId={filters.categoryId}
      onCategoryChange={(categoryId) => router.setParams({ category: categoryId ?? undefined })}
      onClearFilters={() => {
        setSearch("");
        router.replace("/operate/catalog");
      }}
      onLoadMore={() => void products.fetchNextPage()}
      onRetry={refresh}
      onRetryCategories={() => void categories.refetch()}
      onSearchChange={setSearch}
      onStatusChange={(status) => router.setParams({ status: statusParam(status) })}
      search={search}
      searching={search.trim() !== filters.search || products.isPlaceholderData}
      state={state}
      status={filters.status}
    />
  );
}
