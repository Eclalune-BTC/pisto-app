import type { CreateProductRequest, Product, UpdateProductRequest } from "@pisto/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import type { DescriptionItem } from "@/components/layout/description-list";
import { useRouteLabel } from "@/components/shell/shell-context";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
import { isLockedPhase, mutationPhase } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { ChangedValue } from "../cash/review-values";
import { catalogApi } from "./api";
import { productHref } from "./catalog-screen";
import { productPrice, quantityText } from "./format";
import { CatalogLink } from "./product-detail-controller";
import {
  buildProductCommand,
  emptyProductDraft,
  type ProductCommand,
  type ProductDraftErrors,
  type ProductDraftField,
  type ProductDraftFields,
  productToDraft,
  type ResolvedProductFields,
  resolvedProductFields,
} from "./product-draft";
import { type ProductFieldRefs, ProductFormScreen } from "./product-form-screen";
import {
  categoryChoices,
  invalidateCatalogInventory,
  productQueryOptions,
  useCategoryChoices,
} from "./queries";
import { CapabilityRouteState } from "./route-state";
import { hasStaleRead, readState } from "./state";

const fieldOrder: readonly ProductDraftField[] = [
  "name",
  "sku",
  "sellingPrice",
  "lowStockThreshold",
];

function localizedErrors(errors: ProductDraftErrors, t: TFunction): ProductDraftErrors {
  return {
    ...(errors.form ? { form: t("catalog.form.validation.noChanges") } : {}),
    ...(errors.lowStockThreshold
      ? { lowStockThreshold: t("catalog.form.validation.threshold") }
      : {}),
    ...(errors.name ? { name: t("catalog.form.validation.name") } : {}),
    ...(errors.sellingPrice ? { sellingPrice: t("catalog.form.validation.price") } : {}),
    ...(errors.sku ? { sku: t("catalog.form.validation.sku") } : {}),
  };
}

type ReviewContext = {
  categoryNames: ReadonlyMap<string, string>;
  currency: string;
  currencyMinorUnitDigits: number;
  locale: string;
  original: Product | undefined;
  t: TFunction;
};

/** Every field as it will be saved; an edit shows a changed field next to the value it replaces. */
function productReviewItems(command: ProductCommand, context: ReviewContext): DescriptionItem[] {
  const { categoryNames, locale, original, t } = context;
  const describe = (fields: ResolvedProductFields, price: string | null) => ({
    category:
      fields.categoryId === null
        ? t("catalog.detail.noCategory")
        : (categoryNames.get(fields.categoryId) ?? t("catalog.list.categoryUnavailable")),
    name: fields.name,
    precision:
      fields.quantityPrecision === 0
        ? t("catalog.detail.wholeNumbers")
        : t("catalog.detail.precisionValue", { count: fields.quantityPrecision }),
    price: price ?? t("catalog.detail.noPrice"),
    sku: fields.sku ?? t("catalog.detail.noSku"),
    threshold:
      fields.tracked && fields.lowStockThresholdMinorUnits !== null
        ? quantityText(t, locale, {
            minorUnits: fields.lowStockThresholdMinorUnits,
            precision: fields.quantityPrecision,
            unitKind: fields.unitKind,
          })
        : t("catalog.detail.noThreshold"),
    tracked: fields.tracked ? t("common.yes") : t("common.no"),
    unit: t(`catalog.unitLabels.${fields.unitKind}`),
  });
  const resolved = resolvedProductFields(command, original);
  const before = original ? describe(original, productPrice(original, locale)) : null;
  // A changed price takes the business currency; an unchanged one keeps its snapshot.
  const priceAfter =
    original && resolved.sellingPriceMinorUnits === original.sellingPriceMinorUnits
      ? productPrice(original, locale)
      : resolved.sellingPriceMinorUnits === null
        ? null
        : formatMinorUnits(
            resolved.sellingPriceMinorUnits,
            context.currency,
            context.currencyMinorUnitDigits,
            locale,
          );
  const after = describe(resolved, priceAfter);
  const value = (key: keyof typeof after) =>
    before && before[key] !== after[key] ? (
      <ChangedValue after={after[key]} before={before[key]} />
    ) : (
      after[key]
    );
  return [
    { label: t("catalog.form.name"), value: value("name") },
    { label: t("dataTable.columns.sku"), value: value("sku") },
    { label: t("catalog.detail.category"), value: value("category") },
    { label: t("catalog.detail.price"), numeric: true, value: value("price") },
    { label: t("catalog.detail.tracked"), value: value("tracked") },
    { label: t("catalog.detail.unit"), value: value("unit") },
    { label: t("catalog.detail.precision"), value: value("precision") },
    { label: t("catalog.detail.threshold"), numeric: true, value: value("threshold") },
  ];
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
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const businesses = useQuery(businessesQueryOptions);
  const access = readState([businesses]);
  const business = access === "denied" ? undefined : getActiveBusiness(businesses.data);
  const canManage = business?.access.permissions.includes("catalog:manage") ?? false;
  const businessId = canManage ? business?.id : undefined;
  const categories = useCategoryChoices(businessId);
  const productQuery = useQuery(
    productQueryOptions(mode === "edit" ? businessId : undefined, productId),
  );
  const product = productQuery.data?.product;
  const [draft, setDraft] = useState<ProductDraftFields>(emptyProductDraft);
  const [errors, setErrors] = useState<ProductDraftErrors>({});
  const [command, setCommand] = useState<ProductCommand | null>(null);
  const [initializedProduct, setInitializedProduct] = useState<string | null>(null);
  // Each ref is its own top-level hook call: the compiler memoizes object literals, and a hook
  // inside a memoized literal would run on the first render only.
  const nameRef = useRef<TextInput>(null);
  const skuRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const thresholdRef = useRef<TextInput>(null);
  const fieldRefs: ProductFieldRefs = {
    lowStockThreshold: thresholdRef,
    name: nameRef,
    sellingPrice: priceRef,
    sku: skuRef,
  };
  // A rejected draft moves focus to the first field to fix.
  const pendingFocus = useRef<ProductDraftField | null>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    if (target) fieldRefs[target].current?.focus();
  });
  useRouteLabel("/operate/catalog/[productId]", mode === "edit" ? product?.name : undefined);

  // An edit starts from the product once; refreshing it later must not overwrite the draft.
  if (mode === "edit" && product && initializedProduct !== product.id) {
    setInitializedProduct(product.id);
    setDraft(productToDraft(product));
  }

  const mutation = useMutation({
    mutationFn: (input: ProductCommand) => {
      if (mode === "create") return catalogApi.products.create(input as CreateProductRequest);
      if (!productId) throw new Error("The product identifier is missing");
      return catalogApi.products.update(productId, input as UpdateProductRequest);
    },
    onSuccess: async ({ product: saved }) => {
      if (business) await invalidateCatalogInventory(queryClient, business.id);
      notify.success(mode === "create" ? t("catalog.form.created") : t("catalog.form.updated"), {
        description: saved.name,
      });
      router.replace(productHref(saved.id));
    },
  });
  const phase = mutationPhase(mutation);
  const locked = isLockedPhase(phase);

  if (access === "offline") return <CapabilityRouteState kind="offline" width="form" />;
  if (access === "loading") {
    return <CapabilityRouteState kind="loading" variant="form" width="form" />;
  }
  if (access === "error" || access === "notFound") {
    return (
      <CapabilityRouteState kind="error" onRetry={() => void businesses.refetch()} width="form" />
    );
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  const reads = mode === "edit" ? [categories, productQuery] : [categories];
  if (!business || !canManage || readState(reads) === "denied") {
    return <CapabilityRouteState kind="denied" width="form" />;
  }
  if (mode === "edit" && (!productId || readState([productQuery]) === "notFound")) {
    return (
      <CapabilityRouteState
        action={<CatalogLink />}
        description={t("catalog.detail.notFoundDescription")}
        kind="notFound"
        title={t("catalog.detail.notFoundTitle")}
        width="form"
      />
    );
  }
  if (mode === "edit") {
    const read = readState([productQuery]);
    if (read === "offline") return <CapabilityRouteState kind="offline" width="form" />;
    if (read === "error") {
      return (
        <CapabilityRouteState
          kind="error"
          onRetry={() => void productQuery.refetch()}
          width="form"
        />
      );
    }
    // A reviewed command keeps its screen: an uncertain one must stay resendable with its key.
    if (product?.status === "archived" && !command) {
      return <CapabilityRouteState action={<CatalogLink />} kind="unavailable" width="form" />;
    }
    if (!product || initializedProduct !== product.id) {
      return <CapabilityRouteState kind="loading" variant="form" width="form" />;
    }
  }

  const isStale = hasStaleRead(
    mode === "edit" ? [businesses, categories, productQuery] : [businesses, categories],
  );
  const choices = categoryChoices(categories);
  const original = mode === "edit" ? product : undefined;

  const prepareReview = () => {
    if (isStale || locked || command) return;
    if (draft.categoryId && !choices.names.has(draft.categoryId)) {
      setErrors({ form: t("catalog.form.categoriesUnavailable") });
      return;
    }
    const result = buildProductCommand({
      currencyMinorUnitDigits: business.currencyMinorUnitDigits,
      draft,
      idempotencyKey: Crypto.randomUUID(),
      mode,
      original,
    });
    if ("errors" in result) {
      setErrors(localizedErrors(result.errors, t));
      pendingFocus.current = fieldOrder.find((field) => result.errors[field]) ?? null;
      return;
    }
    setErrors({});
    setCommand(result.command);
    mutation.reset();
  };

  return (
    <ProductFormScreen
      categories={choices.items}
      categoriesError={categories.isError}
      categoriesLoading={!choices.complete && !categories.isError}
      currency={business.currency}
      draft={draft}
      errors={errors}
      fieldRefs={fieldRefs}
      hasHistoryLock={original?.tracked ?? false}
      isRefreshing={
        businesses.isFetching ||
        categories.isFetching ||
        (mode === "edit" && productQuery.isFetching)
      }
      isStale={isStale}
      mode={mode}
      mutationMessage={
        mutation.error
          ? productErrorMessage(
              mutation.error,
              t("productErrors.contexts.product.fallback"),
              t,
              "product",
            )
          : undefined
      }
      onCancel={() => {
        if (locked) return;
        router.replace(original ? productHref(original.id) : "/operate/catalog");
      }}
      onConfirm={() => {
        if (!command || phase === "pending") return;
        // The same command may always be sent again; only a first attempt needs fresh data.
        if (phase === "uncertain" || !isStale) mutation.mutate(command);
      }}
      onDraftChange={(next) => {
        if (command || locked) return;
        setDraft(next);
        setErrors({});
      }}
      onEditReview={() => {
        if (locked) return;
        setCommand(null);
        mutation.reset();
      }}
      onRetryCategories={() => void categories.refetch()}
      onRetryRead={() => {
        void businesses.refetch();
        void categories.refetch();
        if (mode === "edit") void productQuery.refetch();
      }}
      onReview={prepareReview}
      phase={phase}
      reviewItems={
        command
          ? productReviewItems(command, {
              categoryNames: choices.names,
              currency: business.currency,
              currencyMinorUnitDigits: business.currencyMinorUnitDigits,
              locale,
              original,
              t,
            })
          : null
      }
    />
  );
}
