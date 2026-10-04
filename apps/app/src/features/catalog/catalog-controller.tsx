import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import type { RouteParam } from "../cash/search-params";
import { type CatalogCollectionState, CatalogScreen } from "./catalog-screen";
import {
  categoryChoices,
  flattenPages,
  type ProductListFilters,
  productsInfiniteOptions,
  useCategoryChoices,
} from "./queries";
import { CapabilityRouteState } from "./route-state";
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

  if (access === "offline") return <CapabilityRouteState kind="offline" />;
  if (access === "loading") return <CapabilityRouteState kind="loading" />;
  if (access === "error" || access === "notFound") {
    return <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  if (!business || !canRead) {
    return (
      <CapabilityRouteState
        description={t("catalog.list.deniedDescription")}
        kind="denied"
        title={t("catalog.list.deniedTitle")}
      />
    );
  }

  const stale = hasStaleRead([businesses, products]);
  // A rejected category read is a rejection of the catalog too; its cached names must go.
  const productsRead = hasDeniedRead([categories]) ? "denied" : readState([products]);
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
      canManage={permissions.includes("catalog:manage") && !stale}
      categories={choices.items}
      categoriesError={categories.isError}
      categoriesLoading={!choices.complete && !categories.isError}
      categoryId={filters.categoryId}
      onCategoryChange={(categoryId) => router.setParams({ category: categoryId ?? undefined })}
      onClearFilters={() => {
        setSearch("");
        router.setParams({ category: undefined, q: undefined, status: undefined });
      }}
      onLoadMore={() => void products.fetchNextPage()}
      onRetry={refresh}
      onRetryCategories={() => void categories.refetch()}
      onSearchChange={setSearch}
      onStatusChange={(status) => router.setParams({ status: statusParam(status) })}
      search={search}
      state={state}
      status={filters.status}
    />
  );
}
