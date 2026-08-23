import { useQuery } from "@tanstack/react-query";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { buildCatalogCopy } from "@/features/catalog/copy";
import { useProductQuery } from "@/features/catalog/queries";
import { flattenPages } from "@/features/catalog/query-keys";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import { isDeniedError, isNotFoundError } from "@/features/catalog/state";
import { MovementHistory, type MovementHistoryState } from "@/features/inventory/movement-history";
import { useMovementsQuery } from "@/features/inventory/queries";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

export default function InventoryHistoryRoute() {
  const router = useRouter();
  const { t } = useTranslation();
  const copy = useMemo(() => buildCatalogCopy(t), [t]);
  const params = useLocalSearchParams<{ productId?: string | string[] }>();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canReadCatalog = business?.access.permissions.includes("catalog:read") ?? false;
  const canReadInventory = business?.access.permissions.includes("inventory:read") ?? false;
  const roleCanManage = business?.access.permissions.includes("inventory:manage") ?? false;
  const canManage = roleCanManage && businesses.fetchStatus !== "paused" && !businesses.isError;
  const product = useProductQuery({
    businessId: business?.id,
    enabled: Boolean(business && canReadCatalog),
    productId,
  });
  const movements = useMovementsQuery({
    businessId: business?.id,
    enabled: Boolean(business && canReadInventory),
    productId,
  });

  const back = {
    label: copy.remote.backToInventory,
    onPress: () => router.replace("/operate/inventory"),
  };

  if (businesses.fetchStatus === "paused" && !businesses.data) {
    return <CapabilityRouteState back={back} kind="offline" />;
  }
  if (businesses.isPending) return <CapabilityRouteState kind="loading" />;
  if (businesses.isError && !businesses.data) {
    return (
      <CapabilityRouteState back={back} kind="error" onRetry={() => void businesses.refetch()} />
    );
  }
  if (!business) return <Redirect href="/business" />;
  if (
    !canReadCatalog ||
    !canReadInventory ||
    isDeniedError(product.error) ||
    isDeniedError(movements.error)
  ) {
    return <CapabilityRouteState back={back} kind="denied" />;
  }
  if (product.isPending) return <CapabilityRouteState kind="loading" />;
  if (!productId || isNotFoundError(product.error) || isNotFoundError(movements.error)) {
    return <CapabilityRouteState back={back} kind="notFound" />;
  }
  if (product.fetchStatus === "paused" && !product.data) {
    return <CapabilityRouteState back={back} kind="offline" />;
  }
  if (product.isError && !product.data) {
    return (
      <CapabilityRouteState
        back={back}
        kind="error"
        onRetry={() => {
          void product.refetch();
          void movements.refetch();
        }}
      />
    );
  }
  if (!product.data?.stock || !product.data.product.tracked) {
    return <CapabilityRouteState back={back} kind="unavailable" />;
  }

  let state: MovementHistoryState;
  if (movements.fetchStatus === "paused" && !movements.data) {
    state = { status: "offline" };
  } else if (movements.isPending) {
    state = { status: "loading" };
  } else if (movements.isError && !movements.data) {
    state = { status: "error" };
  } else {
    state = {
      status: "ready",
      hasNextPage: Boolean(movements.hasNextPage),
      items: flattenPages(movements.data?.pages),
      loadingMore: movements.isFetchingNextPage,
      stale:
        businesses.isError ||
        product.isError ||
        movements.isError ||
        product.fetchStatus === "paused" ||
        (movements.fetchStatus === "paused" && Boolean(movements.data)),
    };
  }

  return (
    <MovementHistory
      canManage={canManage}
      copy={copy.movementHistory}
      onAddMovement={() =>
        router.push({
          pathname: "/operate/inventory/[productId]/new",
          params: { productId },
        })
      }
      onBack={back.onPress}
      onLoadMore={() => void movements.fetchNextPage()}
      onRetry={() => void movements.refetch()}
      onReverse={(movement) =>
        router.push({
          pathname: "/operate/inventory/[productId]/reverse/[movementId]",
          params: { movementId: movement.id, productId },
        })
      }
      product={product.data.product}
      showReadOnlyNotice={!roleCanManage}
      state={state}
      stock={product.data.stock}
    />
  );
}
