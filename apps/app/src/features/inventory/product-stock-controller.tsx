import type { InventoryMovement } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { flattenPages } from "@/lib/pages";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { firstParam, type RouteParam } from "@/lib/route-params";
import { productHref } from "../catalog/catalog-screen";
import { productQueryOptions } from "../catalog/queries";
import { captureDialogFocus, type DialogFocus } from "../catalog/screen-heading";
import { hasStaleRead, readState } from "../catalog/state";
import { ProductStockScreen } from "./product-stock-screen";
import { movementsInfiniteOptions } from "./queries";
import { ReversalDialog } from "./reversal-dialog";

export function InventoryLink() {
  const { t } = useTranslation();
  return (
    <Link asChild href="/operate/inventory">
      <Button accessibilityRole="link" size="sm" variant="outline">
        <Text>{t("inventory.product.goToInventory")}</Text>
      </Button>
    </Link>
  );
}

export default function ProductStockController() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ productId?: RouteParam }>();
  const productId = firstParam(params.productId);
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = access === "denied" ? undefined : getActiveBusiness(businesses.data);
  const permissions = business?.access.permissions ?? [];
  // The product, its unit and its balance come from the catalog read.
  const canRead = permissions.includes("inventory:read") && permissions.includes("catalog:read");
  const readableBusinessId = canRead ? business?.id : undefined;
  const productQuery = useQuery(productQueryOptions(readableBusinessId, productId));
  const movements = useInfiniteQuery(movementsInfiniteOptions(readableBusinessId, productId));
  const [reversing, setReversing] = useState<{
    businessId: string;
    focus: DialogFocus;
    movement: InventoryMovement;
  }>();
  const detail = productQuery.data;
  // A rejected read takes the cached product name out of the breadcrumb too.
  useRouteLabel(
    "/operate/inventory/[productId]",
    readState([businesses, productQuery]) === "denied" ? undefined : detail?.product.name,
  );

  if (access === "offline") return <RouteState kind="offline" />;
  if (access === "loading") return <RouteState kind="loading" variant="detail" />;
  if (access === "error" || access === "notFound") {
    return <RouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  if (!business || !canRead || readState([productQuery]) === "denied") {
    return <RouteState kind="denied" />;
  }
  const read = readState([productQuery]);
  if (!productId || read === "notFound") {
    return (
      <RouteState
        action={<InventoryLink />}
        description={t("inventory.product.notFoundDescription")}
        kind="notFound"
        title={t("inventory.product.notFoundTitle")}
      />
    );
  }
  if (read === "offline") return <RouteState kind="offline" />;
  if (read === "error") {
    return <RouteState kind="error" onRetry={() => void productQuery.refetch()} />;
  }
  if (!detail) {
    return <RouteState kind="loading" label={t("inventory.product.loading")} variant="detail" />;
  }
  if (!detail.stock) {
    return (
      <RouteState
        action={
          <Link asChild href={productHref(detail.product.id)}>
            <Button accessibilityRole="link" size="sm" variant="outline">
              <Text>{t("inventory.product.viewProduct")}</Text>
            </Button>
          </Link>
        }
        description={t("inventory.product.notTrackedDescription")}
        kind="unavailable"
        title={t("inventory.product.notTrackedTitle")}
      />
    );
  }

  const stale = hasStaleRead([businesses, productQuery, movements]);
  const canManage = permissions.includes("inventory:manage");
  const selected = reversing?.businessId === business.id ? reversing : undefined;

  return (
    <>
      <ProductStockScreen
        canManage={canManage}
        isStale={stale}
        movements={{
          items: flattenPages(movements.data),
          page: {
            hasMore: movements.hasNextPage,
            loadingMore: movements.isFetchingNextPage,
            onLoadMore: () => void movements.fetchNextPage(),
          },
          read: readState([movements]),
        }}
        onRetry={() => {
          void businesses.refetch();
          void productQuery.refetch();
          void movements.refetch();
        }}
        onRetryMovements={() => void movements.refetch()}
        onReverse={(movement) =>
          setReversing({ businessId: business.id, focus: captureDialogFocus(), movement })
        }
        product={detail.product}
        refreshing={businesses.isFetching || productQuery.isFetching || movements.isFetching}
        stock={detail.stock}
      />
      {selected ? (
        <ReversalDialog
          businessId={business.id}
          canConfirm={canManage && !stale && detail.product.status === "active"}
          focus={selected.focus}
          key={selected.movement.id}
          movement={selected.movement}
          onClose={() => setReversing(undefined)}
          product={detail.product}
          timeZone={business.timeZone}
        />
      ) : null}
    </>
  );
}
