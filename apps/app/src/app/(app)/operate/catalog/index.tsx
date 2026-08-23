import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { type CatalogCollectionState, CatalogScreen } from "@/features/catalog/catalog-screen";
import { buildCatalogCopy } from "@/features/catalog/copy";
import { useCategoriesQuery, useProductsQuery } from "@/features/catalog/queries";
import type { CatalogStatusFilter } from "@/features/catalog/query-keys";
import { flattenPages } from "@/features/catalog/query-keys";
import { CapabilityRouteState } from "@/features/catalog/route-state";
import { isDeniedError } from "@/features/catalog/state";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

export default function CatalogIndexRoute() {
  const router = useRouter();
  const { i18n, t } = useTranslation();
  const copy = useMemo(() => buildCatalogCopy(t), [t]);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<CatalogStatusFilter>("active");
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canRead = business?.access.permissions.includes("catalog:read") ?? false;
  const roleCanManage = business?.access.permissions.includes("catalog:manage") ?? false;
  const canManage = roleCanManage && businesses.fetchStatus !== "paused" && !businesses.isError;
  const categories = useCategoriesQuery({
    businessId: business?.id,
    enabled: Boolean(business && canRead),
    limit: 50,
    search: "",
    status: "active",
  });
  const products = useProductsQuery({
    businessId: business?.id,
    categoryId,
    enabled: Boolean(business && canRead),
    search,
    status,
  });

  if (businesses.fetchStatus === "paused" && !businesses.data) {
    return <CapabilityRouteState kind="offline" />;
  }
  if (businesses.isPending) return <CapabilityRouteState kind="loading" />;
  if (businesses.isError && !businesses.data) {
    return <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (!business) return <Redirect href="/business" />;

  let state: CatalogCollectionState;
  if (!canRead || isDeniedError(products.error)) {
    state = { status: "denied" };
  } else if (products.fetchStatus === "paused" && !products.data) {
    state = { status: "offline" };
  } else if (products.isPending) {
    state = { status: "loading" };
  } else if (products.isError && !products.data) {
    state = { status: "error" };
  } else {
    state = {
      status: "ready",
      hasNextPage: Boolean(products.hasNextPage),
      items: flattenPages(products.data?.pages),
      loadingMore: products.isFetchingNextPage,
      stale:
        businesses.isError ||
        products.isError ||
        (products.fetchStatus === "paused" && Boolean(products.data)),
    };
  }

  return (
    <CatalogScreen
      canManage={canManage}
      categories={flattenPages(categories.data?.pages)}
      categoriesError={categories.isError}
      categoriesHasNextPage={Boolean(categories.hasNextPage)}
      categoriesLoading={categories.isPending}
      categoriesLoadingMore={categories.isFetchingNextPage}
      categoryId={categoryId}
      copy={copy.list}
      locale={i18n.resolvedLanguage ?? DEFAULT_LOCALE}
      onCategoryChange={setCategoryId}
      onCreateProduct={() => router.push("/operate/catalog/new")}
      onLoadMore={() => void products.fetchNextPage()}
      onLoadMoreCategories={() => void categories.fetchNextPage()}
      onManageCategories={() => router.push("/operate/catalog/categories")}
      onOpenProduct={(productId) =>
        router.push({ pathname: "/operate/catalog/[productId]", params: { productId } })
      }
      onRetry={() => void products.refetch()}
      onRetryCategories={() => void categories.refetch()}
      onSearchChange={setSearch}
      onStatusChange={(nextStatus) => {
        setCategoryId(null);
        setStatus(nextStatus);
      }}
      search={search}
      showReadOnlyNotice={!roleCanManage}
      state={state}
      status={status}
    />
  );
}
