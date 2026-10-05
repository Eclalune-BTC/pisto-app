import type { ArchiveProductRequest } from "@pisto/contracts";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Link, Redirect, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLabel } from "@/components/shell/shell-context";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
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
import { captureDialogFocus, type DialogFocus, dialogReturnFocus } from "./screen-heading";
import { hasStaleRead, readState } from "./state";
import { useKeyedCommand } from "./use-keyed-command";

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
  // Kept after the dialog closes: focus moves once the dialog has unmounted.
  const [archiveFocus, setArchiveFocus] = useState<DialogFocus>({ opener: null, title: null });
  const [archived, setArchived] = useState(false);
  const archive = useKeyedCommand({
    mutationFn: (command: ArchiveProductRequest) => {
      if (!productId) throw new Error("The product identifier is missing");
      return catalogApi.products.archive(productId, command);
    },
    onConfirmed: async ({ product }) => {
      setArchived(true);
      if (business) await invalidateCatalogInventory(queryClient, business.id);
      notify.success(t("catalog.detail.archived"), { description: product.name });
      setArchiving(false);
    },
  });
  // A rejected read takes the cached product name out of the breadcrumb too.
  useRouteLabel(
    "/operate/catalog/[productId]",
    readState([businesses, productQuery]) === "denied" ? undefined : detail?.product.name,
  );

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
  const canManage = permissions.includes("catalog:manage");
  const { phase } = archive;
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
            archive.send(archive.variables);
            return;
          }
          if (stale || !canManage) return;
          // Archiving has no reviewable fields; every attempt in one dialog is the same command.
          archive.send(archive.variables ?? { idempotencyKey: Crypto.randomUUID() });
        },
        onOpen: () => {
          archive.reset();
          setArchiveFocus(captureDialogFocus());
          setArchived(false);
          setArchiving(true);
        },
        open: archiving,
        phase,
        returnFocus: dialogReturnFocus(archiveFocus, archived),
      }}
      canManage={canManage}
      canRecordMovement={permissions.includes("inventory:manage")}
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
