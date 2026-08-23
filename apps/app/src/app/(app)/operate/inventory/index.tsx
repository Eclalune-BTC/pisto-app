import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useState } from "react";

import { catalogInventoryCopy } from "@/features/catalog/copy";
import { flattenPages } from "@/features/catalog/query-keys";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import { isDeniedError } from "@/features/catalog/state";
import {
  type InventoryCollectionState,
  InventoryScreen,
} from "@/features/inventory/inventory-screen";
import { useStockQuery } from "@/features/inventory/queries";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

export default function InventoryIndexRoute() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canRead = business?.access.permissions.includes("inventory:read") ?? false;
  const roleCanManage = business?.access.permissions.includes("inventory:manage") ?? false;
  const stock = useStockQuery({
    businessId: business?.id,
    enabled: Boolean(business && canRead),
    lowStockOnly,
    search,
  });

  if (businesses.fetchStatus === "paused" && !businesses.data) {
    return <CapabilityRouteState kind="offline" />;
  }
  if (businesses.isPending) return <CapabilityRouteState kind="loading" />;
  if (businesses.isError && !businesses.data) {
    return <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (!business) return <Redirect href="/business" />;

  let state: InventoryCollectionState;
  if (!canRead || isDeniedError(stock.error)) {
    state = { status: "denied" };
  } else if (stock.fetchStatus === "paused" && !stock.data) {
    state = { status: "offline" };
  } else if (stock.isPending) {
    state = { status: "loading" };
  } else if (stock.isError && !stock.data) {
    state = { status: "error" };
  } else {
    state = {
      status: "ready",
      hasNextPage: Boolean(stock.hasNextPage),
      items: flattenPages(stock.data?.pages),
      loadingMore: stock.isFetchingNextPage,
      stale:
        businesses.isError ||
        stock.isError ||
        (stock.fetchStatus === "paused" && Boolean(stock.data)),
    };
  }

  return (
    <InventoryScreen
      copy={catalogInventoryCopy.inventory}
      lowStockOnly={lowStockOnly}
      onLoadMore={() => void stock.fetchNextPage()}
      onLowStockOnlyChange={setLowStockOnly}
      onOpenHistory={(productId) =>
        router.push({ pathname: "/operate/inventory/[productId]", params: { productId } })
      }
      onRetry={() => void stock.refetch()}
      onSearchChange={setSearch}
      search={search}
      showReadOnlyNotice={!roleCanManage}
      state={state}
    />
  );
}
