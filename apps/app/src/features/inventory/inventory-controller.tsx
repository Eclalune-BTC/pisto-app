import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { hasDeniedRead } from "@/lib/query-state";
import type { RouteParam } from "../cash/search-params";
import {
  categoryChoices,
  flattenPages,
  type StockListFilters,
  useCategoryChoices,
} from "../catalog/queries";
import { CapabilityRouteState } from "../catalog/route-state";
import { parseLowStockParam, parseSearchParam, useSearchInput } from "../catalog/search-params";
import { hasStaleRead, readState } from "../catalog/state";
import { type InventoryCollectionState, InventoryScreen } from "./inventory-screen";
import { stockInfiniteOptions } from "./queries";

export default function InventoryController() {
  const { t } = useTranslation();
  const router = useRouter();
  // Filters live in the URL so that returning from a product restores the same list.
  const params = useLocalSearchParams<{ low?: RouteParam; q?: RouteParam }>();
  const filters: StockListFilters = {
    lowStockOnly: parseLowStockParam(params.low),
    search: parseSearchParam(params.q),
  };
  const [search, setSearch] = useSearchInput(filters.search, (q) => router.setParams({ q }));
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = access === "denied" ? undefined : getActiveBusiness(businesses.data);
  const permissions = business?.access.permissions ?? [];
  const canRead = permissions.includes("inventory:read");
  const canReadCatalog = permissions.includes("catalog:read");
  const stock = useInfiniteQuery(stockInfiniteOptions(canRead ? business?.id : undefined, filters));
  const categories = useCategoryChoices(canRead && canReadCatalog ? business?.id : undefined);

  if (access === "offline") return <CapabilityRouteState kind="offline" />;
  if (access === "loading") return <CapabilityRouteState kind="loading" />;
  if (access === "error" || access === "notFound") {
    return <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  if (!business || !canRead) {
    return (
      <CapabilityRouteState
        description={t("inventory.list.deniedDescription")}
        kind="denied"
        title={t("inventory.list.deniedTitle")}
      />
    );
  }

  const stale = hasStaleRead([businesses, stock]);
  // Rows kept from the previous filter must not stand in for a filter that cannot load offline.
  const read =
    stock.isPlaceholderData && stock.fetchStatus === "paused" ? "offline" : readState([stock]);
  const state: InventoryCollectionState =
    read === "ready"
      ? {
          status: "ready",
          hasNextPage: stock.hasNextPage,
          items: flattenPages(stock.data),
          loadingMore: stock.isFetchingNextPage,
          previous: stock.isPlaceholderData,
          refreshing: stock.isFetching,
          stale,
        }
      : { status: read === "notFound" ? "error" : read };
  const choices = categoryChoices(categories);

  return (
    <InventoryScreen
      categories={
        // A rejected category read takes every cached category name off the table.
        canReadCatalog && !hasDeniedRead([categories])
          ? { complete: choices.complete, failed: categories.isError, names: choices.names }
          : null
      }
      lowStockOnly={filters.lowStockOnly}
      onClearFilters={() => {
        setSearch("");
        router.replace("/operate/inventory");
      }}
      onLoadMore={() => void stock.fetchNextPage()}
      onLowStockOnlyChange={(lowStockOnly) =>
        router.setParams({ low: lowStockOnly ? "1" : undefined })
      }
      onRetry={() => {
        void businesses.refetch();
        void stock.refetch();
      }}
      onSearchChange={setSearch}
      search={search}
      searching={search.trim() !== filters.search || stock.isPlaceholderData}
      state={state}
    />
  );
}
