import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { catalogApi } from "@/features/catalog/api";
import { catalogInventoryCopy } from "@/features/catalog/copy";
import { ProductDetailScreen, type ProductDetailState } from "@/features/catalog/product-detail";
import { useCategoriesQuery, useProductQuery } from "@/features/catalog/queries";
import { catalogInventoryQueryKeys, flattenPages } from "@/features/catalog/query-keys";
import {
  isDeniedError,
  isNotFoundError,
  mutationErrorMessage,
  mutationUiState,
} from "@/features/catalog/state";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import type { ArchiveProductRequest } from "@pisto/contracts";

export default function ProductDetailRoute() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ productId?: string | string[] }>();
  const productId = Array.isArray(params.productId) ? params.productId[0] : params.productId;
  const [archiveCommand, setArchiveCommand] = useState<ArchiveProductRequest | null>(null);
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const roleCanRead = business?.access.permissions.includes("catalog:read") ?? false;
  const roleCanManage = business?.access.permissions.includes("catalog:manage") ?? false;
  const accessCurrent = businesses.fetchStatus !== "paused" && !businesses.isError;
  const product = useProductQuery({
    businessId: business?.id,
    enabled: Boolean(business && roleCanRead),
    productId,
  });
  const categoryId = product.data?.product.categoryId ?? null;
  const categories = useCategoriesQuery({
    businessId: business?.id,
    enabled: Boolean(business && roleCanRead && categoryId),
    limit: 50,
    search: "",
    status: "all",
  });
  const categoryItems = flattenPages(categories.data?.pages);
  const categoryName = categoryId ? categoryItems.find(({ id }) => id === categoryId)?.name : null;

  useEffect(() => {
    if (
      categoryId &&
      !categoryName &&
      categories.hasNextPage &&
      !categories.isFetchingNextPage &&
      !categories.isError
    ) {
      void categories.fetchNextPage();
    }
  }, [
    categories.fetchNextPage,
    categories.hasNextPage,
    categories.isError,
    categories.isFetchingNextPage,
    categoryId,
    categoryName,
  ]);

  const archive = useMutation({
    mutationFn: (command: ArchiveProductRequest) =>
      catalogApi.products.archive(productId as string, command),
    networkMode: "always",
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: catalogInventoryQueryKeys.productsRoot(business?.id),
        }),
        queryClient.invalidateQueries({
          queryKey: catalogInventoryQueryKeys.stockRoot(business?.id),
        }),
      ]);
      setArchiveCommand(null);
    },
  });

  if (businesses.isPending && !businesses.data) {
    return (
      <ProductDetailScreen
        archiveReview={false}
        archiveState="idle"
        canManage={false}
        categoryName={null}
        copy={catalogInventoryCopy.productDetail}
        locale={catalogInventoryCopy.locale}
        onArchive={() => undefined}
        onBack={() => router.replace("/operate/catalog")}
        onCancelArchive={() => undefined}
        onEdit={() => undefined}
        onRequestArchive={() => undefined}
        onResolveUncertain={() => undefined}
        onRetry={() => void businesses.refetch()}
        showReadOnlyNotice={false}
        state={{ status: "loading" }}
      />
    );
  }
  if (!business && businesses.data) return <Redirect href="/business" />;

  let state: ProductDetailState;
  if (businesses.fetchStatus === "paused" && !businesses.data) {
    state = { status: "offline" };
  } else if (businesses.isError && !businesses.data) {
    state = { status: "error" };
  } else if (
    !business ||
    !roleCanRead ||
    isDeniedError(product.error) ||
    isDeniedError(categories.error)
  ) {
    state = { status: "denied" };
  } else if (
    (product.fetchStatus === "paused" && !product.data) ||
    (categoryId && categories.fetchStatus === "paused" && !categories.data)
  ) {
    state = { status: "offline" };
  } else if (isNotFoundError(product.error) || !productId) {
    state = { status: "notFound" };
  } else if (
    product.isPending ||
    (categoryId &&
      (categories.isPending || (!categoryName && categories.hasNextPage && !categories.isError)))
  ) {
    state = { status: "loading" };
  } else if (
    (product.isError && !product.data) ||
    (categoryId && categories.isError && !categories.data)
  ) {
    state = { status: "error" };
  } else if (product.data) {
    state = {
      status: "ready",
      detail: product.data,
      stale:
        businesses.isError ||
        product.isError ||
        categories.isError ||
        product.fetchStatus === "paused" ||
        categories.fetchStatus === "paused",
    };
  } else {
    state = { status: "error" };
  }

  const archiveState = mutationUiState({ error: archive.error, isPending: archive.isPending });
  const confirmArchive = () => {
    if (archiveCommand) archive.mutate(archiveCommand);
  };

  return (
    <ProductDetailScreen
      archiveReview={archiveCommand !== null}
      archiveState={archiveState}
      canManage={roleCanManage && accessCurrent}
      categoryName={
        categoryId ? (categoryName ?? catalogInventoryCopy.productDetail.categoryUnavailable) : null
      }
      copy={catalogInventoryCopy.productDetail}
      locale={catalogInventoryCopy.locale}
      mutationMessage={
        archive.error ? mutationErrorMessage(archive.error, "archiveProduct") : undefined
      }
      onArchive={confirmArchive}
      onBack={() => router.replace("/operate/catalog")}
      onCancelArchive={() => {
        archive.reset();
        setArchiveCommand(null);
      }}
      onEdit={() =>
        router.push({
          pathname: "/operate/catalog/[productId]/edit",
          params: { productId: productId as string },
        })
      }
      onRequestArchive={() => {
        archive.reset();
        setArchiveCommand({ idempotencyKey: Crypto.randomUUID() });
      }}
      onResolveUncertain={confirmArchive}
      onRetry={() => {
        void businesses.refetch();
        void product.refetch();
        if (categoryId) void categories.refetch();
      }}
      showReadOnlyNotice={!roleCanManage}
      state={state}
    />
  );
}
