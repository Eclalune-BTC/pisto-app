import type { ArchiveProductRequest } from "@pisto/contracts";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { focusReturnTarget } from "@/lib/focus-return";
import { mutationPhase } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { isAccessDeniedError } from "@/lib/query-state";
import { firstParam, type RouteParam } from "../cash/search-params";
import { movementsInfiniteOptions } from "../inventory/queries";
import { catalogApi } from "./api";
import { ProductDetailScreen } from "./product-detail-screen";
import {
  categoryChoices,
  flattenPages,
  invalidateCatalogInventory,
  productQueryOptions,
  useCategoryChoices,
} from "./queries";
import { CapabilityRouteState } from "./route-state";
import { hasStaleRead, readState } from "./state";

export function CatalogLink() {
  const { t } = useTranslation();
  return (
    <Link asChild href="/operate/catalog">
      <Button accessibilityRole="link" size="sm" variant="outline">
        <Text>{t("catalog.detail.goToCatalog")}</Text>
      </Button>
    </Link>
  );
}

export default function ProductDetailController() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ productId?: RouteParam }>();
  const productId = firstParam(params.productId);
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = access === "denied" ? undefined : getActiveBusiness(businesses.data);
  const permissions = business?.access.permissions ?? [];
  const canRead = permissions.includes("catalog:read");
  const productQuery = useQuery(productQueryOptions(canRead ? business?.id : undefined, productId));
  const detail = productQuery.data;
  const categories = useCategoryChoices(
    canRead && detail?.product.categoryId ? business?.id : undefined,
  );
  const showsMovements = permissions.includes("inventory:read") && detail?.stock != null;
  const movements = useInfiniteQuery(
    movementsInfiniteOptions(showsMovements ? business?.id : undefined, productId),
  );
  const [archiving, setArchiving] = useState(false);
  // Kept after the dialog closes: focus returns to the opener once the dialog has unmounted.
  const [archiveOpener, setArchiveOpener] = useState<HTMLElement | null>(null);
  const archive = useMutation({
    mutationFn: (command: ArchiveProductRequest) => {
      if (!productId) throw new Error("The product identifier is missing");
      return catalogApi.products.archive(productId, command);
    },
    onSuccess: async ({ product }) => {
      if (business) await invalidateCatalogInventory(queryClient, business.id);
      notify.success(t("catalog.detail.archived"), { description: product.name });
      setArchiving(false);
    },
  });
  useRouteLabel("/operate/catalog/[productId]", detail?.product.name);

  if (access === "offline") return <CapabilityRouteState kind="offline" />;
  if (access === "loading") return <CapabilityRouteState kind="loading" variant="detail" />;
  if (access === "error" || access === "notFound") {
    return <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  const productRead = readState([productQuery, categories]);
  if (!business || !canRead || productRead === "denied") {
    return <CapabilityRouteState kind="denied" />;
  }
  if (!productId || readState([productQuery]) === "notFound") {
    return (
      <CapabilityRouteState
        action={<CatalogLink />}
        description={t("catalog.detail.notFoundDescription")}
        kind="notFound"
        title={t("catalog.detail.notFoundTitle")}
      />
    );
  }
  const read = readState([productQuery]);
  if (read === "offline") return <CapabilityRouteState kind="offline" />;
  if (read === "error") {
    return <CapabilityRouteState kind="error" onRetry={() => void productQuery.refetch()} />;
  }
  if (!detail) {
    return (
      <CapabilityRouteState kind="loading" label={t("catalog.detail.loading")} variant="detail" />
    );
  }

  const stale = hasStaleRead([businesses, productQuery]);
  const canManage = permissions.includes("catalog:manage") && !stale;
  const phase = mutationPhase(archive);
  const choices = categoryChoices(categories);
  const categoryId = detail.product.categoryId;
  const categoryName =
    categoryId === null
      ? null
      : (choices.names.get(categoryId) ??
        (choices.complete || categories.isError
          ? t("catalog.list.categoryUnavailable")
          : undefined));

  return (
    <ProductDetailScreen
      archive={{
        errorMessage: archive.error
          ? productErrorMessage(
              archive.error,
              t("productErrors.contexts.archiveProduct.fallback"),
              t,
              "archiveProduct",
            )
          : undefined,
        onCancel: () => {
          setArchiving(false);
          archive.reset();
        },
        onConfirm: () => {
          if (phase === "pending") return;
          // The same command may always be sent again; only a first attempt needs fresh access.
          if (phase === "uncertain" && archive.variables) {
            archive.mutate(archive.variables);
            return;
          }
          if (!canManage) return;
          // Archiving has no reviewable fields; every attempt in one dialog is the same command.
          archive.mutate(archive.variables ?? { idempotencyKey: Crypto.randomUUID() });
        },
        onOpen: () => {
          archive.reset();
          setArchiveOpener(focusReturnTarget());
          setArchiving(true);
        },
        open: archiving,
        phase,
        returnFocus: archiveOpener,
      }}
      canManage={canManage}
      canRecordMovement={permissions.includes("inventory:manage") && !stale}
      categoryName={categoryName}
      detail={detail}
      isStale={stale}
      movements={
        showsMovements && !isAccessDeniedError(movements.error)
          ? { items: flattenPages(movements.data), read: readState([movements]) }
          : null
      }
      onRetry={() => {
        void businesses.refetch();
        void productQuery.refetch();
      }}
      onRetryMovements={() => void movements.refetch()}
      refreshing={businesses.isFetching || productQuery.isFetching}
      timeZone={business.timeZone}
    />
  );
}
