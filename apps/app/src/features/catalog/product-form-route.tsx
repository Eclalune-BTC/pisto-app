import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { formatMinorUnits } from "@/lib/money";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import type {
  CreateProductRequest,
  Product,
  ProductUnitKind,
  UpdateProductRequest,
} from "../../../../../packages/contracts/src/catalog";
import { formatQuantityMinorUnits } from "../inventory/quantity";
import { catalogApi } from "./api";
import { catalogInventoryCopy } from "./copy";
import { buildProductCommand, productToDraft } from "./product-draft";
import { type ProductDraftErrors, type ProductDraftFields, ProductEditor } from "./product-editor";
import { useCategoriesQuery, useProductQuery } from "./queries";
import { catalogInventoryQueryKeys, flattenPages } from "./query-keys";
import { CapabilityRouteState } from "./route-state";
import { isDeniedError, isNotFoundError, mutationErrorMessage, mutationUiState } from "./state";

const emptyDraft: ProductDraftFields = {
  categoryId: null,
  lowStockThreshold: "",
  name: "",
  quantityPrecision: 0,
  sellingPrice: "",
  sku: "",
  tracked: false,
  unitKind: "unit",
};

type ProductCommand = CreateProductRequest | UpdateProductRequest;

function localizeDraftErrors(errors: ProductDraftErrors): ProductDraftErrors {
  const copy = catalogInventoryCopy.productEditor.validation;
  return {
    ...(errors.form ? { form: copy.noChanges } : {}),
    ...(errors.lowStockThreshold ? { lowStockThreshold: copy.threshold } : {}),
    ...(errors.name ? { name: copy.name } : {}),
    ...(errors.sellingPrice ? { sellingPrice: copy.price } : {}),
    ...(errors.sku ? { sku: copy.sku } : {}),
  };
}

function resolvedFields(command: ProductCommand, original: Product | undefined) {
  const update = command as UpdateProductRequest;
  const create = command as CreateProductRequest;
  const editing = original !== undefined;
  return {
    categoryId: editing
      ? update.categoryId === undefined
        ? original.categoryId
        : update.categoryId
      : (create.categoryId ?? null),
    lowStockThresholdMinorUnits: editing
      ? update.lowStockThresholdMinorUnits === undefined
        ? original.lowStockThresholdMinorUnits
        : update.lowStockThresholdMinorUnits
      : (create.lowStockThresholdMinorUnits ?? null),
    name: editing ? (update.name ?? original.name) : create.name,
    quantityPrecision: editing
      ? (update.quantityPrecision ?? original.quantityPrecision)
      : create.quantityPrecision,
    sellingPriceMinorUnits: editing
      ? update.sellingPriceMinorUnits === undefined
        ? original.sellingPriceMinorUnits
        : update.sellingPriceMinorUnits
      : (create.sellingPriceMinorUnits ?? null),
    sku: editing ? (update.sku === undefined ? original.sku : update.sku) : (create.sku ?? null),
    tracked: editing ? (update.tracked ?? original.tracked) : create.tracked,
    unitKind: editing ? (update.unitKind ?? original.unitKind) : create.unitKind,
  };
}

export function ProductFormRoute({
  mode,
  productId,
}: {
  mode: "create" | "edit";
  productId?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const canManage = business?.access.permissions.includes("catalog:manage") ?? false;
  const categories = useCategoriesQuery({
    businessId: business?.id,
    enabled: Boolean(business && canManage),
    limit: 50,
    search: "",
    status: mode === "edit" ? "all" : "active",
  });
  const productQuery = useProductQuery({
    businessId: business?.id,
    enabled: mode === "edit" && Boolean(business),
    productId,
  });
  const categoryItems = flattenPages(categories.data?.pages);
  const product = productQuery.data?.product;
  const [draft, setDraft] = useState<ProductDraftFields>(emptyDraft);
  const [errors, setErrors] = useState<ProductDraftErrors>({});
  const [command, setCommand] = useState<ProductCommand | null>(null);
  const [initializedProduct, setInitializedProduct] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !product || initializedProduct === product.id) return;
    setDraft(productToDraft(product));
    setInitializedProduct(product.id);
  }, [initializedProduct, mode, product]);

  const currentCategoryMissing =
    mode === "edit" &&
    Boolean(product?.categoryId) &&
    !categoryItems.some(({ id }) => id === product?.categoryId);
  useEffect(() => {
    if (
      currentCategoryMissing &&
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
    currentCategoryMissing,
  ]);

  const mutation = useMutation({
    mutationFn: (input: ProductCommand) =>
      mode === "create"
        ? catalogApi.products.create(input as CreateProductRequest)
        : catalogApi.products.update(productId as string, input as UpdateProductRequest),
    networkMode: "always",
    onSuccess: async ({ product: savedProduct }) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: catalogInventoryQueryKeys.productsRoot(business?.id),
        }),
        queryClient.invalidateQueries({
          queryKey: catalogInventoryQueryKeys.stockRoot(business?.id),
        }),
      ]);
      router.replace({
        pathname: "/operate/catalog/[productId]",
        params: { productId: savedProduct.id },
      });
    },
  });

  const mutationState = mutationUiState({ error: mutation.error, isPending: mutation.isPending });

  const reviewItems = useMemo(() => {
    if (!command || !business) return null;
    const fields = resolvedFields(command, mode === "edit" ? product : undefined);
    const categoryName = fields.categoryId
      ? categoryItems.find(({ id }) => id === fields.categoryId)?.name
      : null;
    const copy = catalogInventoryCopy.productEditor;
    const price =
      fields.sellingPriceMinorUnits === null
        ? copy.reviewFields.noPrice
        : formatMinorUnits(
            fields.sellingPriceMinorUnits,
            business.currency,
            business.currencyMinorUnitDigits,
            catalogInventoryCopy.locale,
          );
    const threshold =
      fields.lowStockThresholdMinorUnits === null
        ? copy.reviewFields.noThreshold
        : formatQuantityMinorUnits(fields.lowStockThresholdMinorUnits, fields.quantityPrecision);
    return [
      { label: copy.reviewFields.name, value: fields.name },
      { label: copy.reviewFields.sku, value: fields.sku ?? copy.reviewFields.noSku },
      { label: copy.reviewFields.price, value: price },
      {
        label: copy.reviewFields.category,
        value: categoryName ?? copy.noCategory,
      },
      {
        label: copy.reviewFields.unit,
        value: copy.unitLabels[fields.unitKind as ProductUnitKind],
      },
      { label: copy.reviewFields.precision, value: String(fields.quantityPrecision) },
      {
        label: copy.reviewFields.tracked,
        value: fields.tracked ? catalogInventoryCopy.common.yes : catalogInventoryCopy.common.no,
      },
      { label: copy.reviewFields.threshold, value: threshold },
    ];
  }, [business, categoryItems, command, mode, product]);

  if (businesses.fetchStatus === "paused") {
    return <CapabilityRouteState kind="offline" />;
  }
  if (businesses.isPending) return <CapabilityRouteState kind="loading" />;
  if (businesses.isError) {
    return <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} />;
  }
  if (!business) return <Redirect href="/business" />;
  if (!canManage || isDeniedError(productQuery.error) || isDeniedError(categories.error)) {
    return (
      <CapabilityRouteState
        back={{
          label: catalogInventoryCopy.remote.backToCatalog,
          onPress: () => router.replace("/operate/catalog"),
        }}
        kind="denied"
      />
    );
  }
  if (
    categories.fetchStatus === "paused" ||
    (mode === "edit" && productQuery.fetchStatus === "paused")
  ) {
    return (
      <CapabilityRouteState
        back={{
          label: catalogInventoryCopy.remote.backToCatalog,
          onPress: () => router.replace("/operate/catalog"),
        }}
        kind="offline"
      />
    );
  }
  if (categories.isPending || (mode === "edit" && productQuery.isPending)) {
    return <CapabilityRouteState kind="loading" />;
  }
  if (mode === "edit" && isNotFoundError(productQuery.error)) {
    return (
      <CapabilityRouteState
        back={{
          label: catalogInventoryCopy.remote.backToCatalog,
          onPress: () => router.replace("/operate/catalog"),
        }}
        kind="notFound"
      />
    );
  }
  if (
    (categories.isError && !categories.data) ||
    (mode === "edit" && productQuery.isError && !productQuery.data)
  ) {
    return (
      <CapabilityRouteState
        back={{
          label: catalogInventoryCopy.remote.backToCatalog,
          onPress: () => router.replace("/operate/catalog"),
        }}
        kind="error"
        onRetry={() => {
          void categories.refetch();
          if (mode === "edit") void productQuery.refetch();
        }}
      />
    );
  }
  if (mode === "edit" && (!product || product.status === "archived")) {
    return (
      <CapabilityRouteState
        back={{
          label: catalogInventoryCopy.remote.backToCatalog,
          onPress: () => router.replace("/operate/catalog"),
        }}
        kind="unavailable"
      />
    );
  }
  if (mode === "edit" && initializedProduct !== product?.id) {
    return <CapabilityRouteState kind="loading" />;
  }

  const prepareReview = () => {
    if (draft.categoryId && !categoryItems.some(({ id }) => id === draft.categoryId)) {
      setErrors({ form: catalogInventoryCopy.productEditor.categoriesUnavailable });
      return;
    }
    const result = buildProductCommand({
      currencyMinorUnitDigits: business.currencyMinorUnitDigits,
      draft,
      idempotencyKey: Crypto.randomUUID(),
      mode,
      original: mode === "edit" ? product : undefined,
    });
    if ("errors" in result) {
      setErrors(localizeDraftErrors(result.errors));
      return;
    }
    setErrors({});
    setCommand(result.command);
    mutation.reset();
  };

  const confirm = () => {
    if (command) mutation.mutate(command);
  };

  return (
    <ProductEditor
      categories={categoryItems}
      categoriesError={categories.isError}
      categoriesHasNextPage={Boolean(categories.hasNextPage)}
      categoriesLoadingMore={categories.isFetchingNextPage}
      copy={catalogInventoryCopy.productEditor}
      currency={business.currency}
      draft={draft}
      errors={errors}
      mode={mode}
      mutationMessage={mutation.error ? mutationErrorMessage(mutation.error, "product") : undefined}
      mutationState={mutationState}
      onBack={() =>
        mode === "edit" && productId
          ? router.replace({
              pathname: "/operate/catalog/[productId]",
              params: { productId },
            })
          : router.replace("/operate/catalog")
      }
      onConfirm={confirm}
      onDraftChange={(nextDraft) => {
        setDraft(nextDraft);
        setErrors({});
      }}
      onEditReview={() => {
        if (mutationState === "uncertain") return;
        setCommand(null);
        mutation.reset();
      }}
      onLoadMoreCategories={() => void categories.fetchNextPage()}
      onResolveUncertain={confirm}
      onRetryCategories={() => void categories.refetch()}
      onReview={prepareReview}
      reviewItems={reviewItems}
    />
  );
}
