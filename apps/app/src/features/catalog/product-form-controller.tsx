import type { CreateProductRequest, Product, UpdateProductRequest } from "@pisto/contracts";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { Redirect, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TextInput } from "react-native";
import type { DescriptionItem } from "@/components/layout/description-list";
import { ChangedValue } from "@/components/layout/review-values";
import { RouteState } from "@/components/route-state";
import { useRouteLabel } from "@/components/shell/shell-context";
import { requireSupportedLocale } from "@/i18n/locale";
import { ApiClientError } from "@/lib/api-error";
import { useKeyedCommand } from "@/lib/keyed-command";
import { formatMinorUnits } from "@/lib/money";
import { isLockedPhase } from "@/lib/mutation-phase";
import { notify } from "@/lib/notify";
import { productErrorMessage } from "@/lib/product-errors";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { isAccessDeniedError } from "@/lib/query-state";
import { movementsInfiniteOptions } from "../inventory/queries";
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
  withFrozenHistoryFields,
} from "./product-draft";
import { type ProductFieldRefs, ProductFormScreen } from "./product-form-screen";
import {
  categoryChoices,
  flattenPages,
  invalidateCatalogInventory,
  productQueryOptions,
  useCategoryChoices,
} from "./queries";
import { hasStaleRead, readState } from "./state";

const fieldOrder: readonly ProductDraftField[] = [
  "name",
  "sku",
  "sellingPrice",
  "lowStockThreshold",
];

function localizedErrors(
  errors: ProductDraftErrors,
  decimals: { price: number; quantity: number },
  t: TFunction,
): ProductDraftErrors {
  return {
    ...(errors.form ? { form: t("catalog.form.validation.noChanges") } : {}),
    ...(errors.lowStockThreshold
      ? {
          lowStockThreshold:
            decimals.quantity === 0
              ? t("catalog.form.validation.thresholdWhole")
              : t("catalog.form.validation.threshold", { count: decimals.quantity }),
        }
      : {}),
    ...(errors.name
      ? {
          name:
            errors.name === "missing"
              ? t("catalog.form.validation.nameMissing")
              : t("catalog.form.validation.nameTooLong"),
        }
      : {}),
    ...(errors.sellingPrice
      ? {
          sellingPrice:
            decimals.price === 0
              ? t("catalog.form.validation.priceWhole")
              : t("catalog.form.validation.price", { count: decimals.price }),
        }
      : {}),
    ...(errors.sku ? { sku: t("catalog.form.validation.sku") } : {}),
  };
}

/**
 * Why a save was refused. The server refuses a duplicate SKU, an archived product, and a unit,
 * decimals or tracking change once movements exist; while the product is still active and the
 * command changed only one of those, the message names it.
 */
export function productSaveMessage(
  error: unknown,
  command: ProductCommand,
  current: Product | undefined,
  t: TFunction,
): string {
  if (error instanceof ApiClientError && error.code === "CONFLICT") {
    if (current?.status === "archived") return t("catalog.form.conflicts.archived");
    const changesSku = command.sku != null;
    const changesHistory =
      current !== undefined &&
      ("unitKind" in command || "quantityPrecision" in command || command.tracked === false);
    if (changesSku && !changesHistory) return t("catalog.form.conflicts.sku");
    if (changesHistory && !changesSku) return t("catalog.form.conflicts.history");
  }
  return productErrorMessage(error, t("productErrors.contexts.product.fallback"), t, "product");
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
  const value = (key: keyof typeof after, numeric = false) =>
    before && before[key] !== after[key] ? (
      <ChangedValue after={after[key]} before={before[key]} numeric={numeric} />
    ) : (
      after[key]
    );
  return [
    { label: t("catalog.form.name"), value: value("name") },
    { label: t("dataTable.columns.sku"), value: value("sku") },
    { label: t("catalog.detail.category"), value: value("category") },
    { label: t("catalog.detail.price"), numeric: true, value: value("price", true) },
    { label: t("catalog.detail.tracked"), value: value("tracked") },
    { label: t("catalog.detail.unit"), value: value("unit") },
    { label: t("catalog.detail.precision"), value: value("precision") },
    { label: t("catalog.detail.threshold"), numeric: true, value: value("threshold", true) },
  ];
}

/**
 * Whether movements freeze the unit, decimals and tracking: once a tracked product has history,
 * the server refuses those changes. A balance other than zero proves history without reading it;
 * otherwise the first page of the history answers, and a history that cannot be read leaves the
 * decision to the server.
 */
function historyFreezes(
  product: Product,
  onHandMinorUnits: string | undefined,
  history: { read: boolean; movements: number },
): boolean {
  if (!product.tracked) return false;
  if (onHandMinorUnits !== undefined && onHandMinorUnits !== "0") return true;
  return history.read && history.movements > 0;
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
  const permissions = business?.access.permissions ?? [];
  const canManage = permissions.includes("catalog:manage");
  const businessId = canManage ? business?.id : undefined;
  const categories = useCategoryChoices(businessId);
  const productQuery = useQuery(
    productQueryOptions(mode === "edit" ? businessId : undefined, productId),
  );
  const product = productQuery.data?.product;
  const readsHistory =
    mode === "edit" && permissions.includes("inventory:read") && product?.tracked === true;
  const history = useInfiniteQuery(
    movementsInfiniteOptions(readsHistory ? businessId : undefined, productId),
  );
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
  // A rejected read takes the cached product name out of the breadcrumb too.
  useRouteLabel(
    "/operate/catalog/[productId]",
    mode === "edit" && readState([businesses, productQuery]) !== "denied"
      ? product?.name
      : undefined,
  );

  // An edit starts from the product once; refreshing it later must not overwrite the draft.
  if (mode === "edit" && product && initializedProduct !== product.id) {
    setInitializedProduct(product.id);
    setDraft(productToDraft(product));
  }

  const mutation = useKeyedCommand({
    mutationFn: (input: ProductCommand) => {
      if (mode === "create") return catalogApi.products.create(input as CreateProductRequest);
      if (!productId) throw new Error("The product identifier is missing");
      return catalogApi.products.update(productId, input as UpdateProductRequest);
    },
    onConfirmed: async ({ product: saved }) => {
      if (business) await invalidateCatalogInventory(queryClient, business.id);
      notify.success(mode === "create" ? t("catalog.form.created") : t("catalog.form.updated"), {
        description: saved.name,
      });
      router.replace(productHref(saved.id));
    },
    // A conflict means the product or its history changed; the message reads the current state.
    onRejected: (error) => {
      if (business && error instanceof ApiClientError && error.code === "CONFLICT") {
        void invalidateCatalogInventory(queryClient, business.id);
      }
    },
  });
  const { phase } = mutation;
  const locked = isLockedPhase(phase);

  if (access === "offline") return <RouteState kind="offline" width="form" />;
  if (access === "loading") {
    return <RouteState kind="loading" variant="form" width="form" />;
  }
  if (access === "error" || access === "notFound") {
    return <RouteState kind="error" onRetry={() => void businesses.refetch()} width="form" />;
  }
  if (access === "ready" && !business) return <Redirect href="/business" />;
  const reads = mode === "edit" ? [categories, productQuery] : [categories];
  if (!business || !canManage || readState(reads) === "denied") {
    return <RouteState kind="denied" width="form" />;
  }
  if (mode === "edit" && (!productId || readState([productQuery]) === "notFound")) {
    return (
      <RouteState
        action={<CatalogLink />}
        description={t("catalog.detail.notFoundDescription")}
        kind="notFound"
        title={t("catalog.detail.notFoundTitle")}
        width="form"
      />
    );
  }
  const original = mode === "edit" ? product : undefined;
  const historyRead =
    readsHistory && !isAccessDeniedError(history.error) ? readState([history]) : null;
  const historyLocked = original
    ? historyFreezes(original, productQuery.data?.stock?.onHandMinorUnits, {
        movements: flattenPages(history.data).length,
        read: historyRead === "ready",
      })
    : false;
  if (mode === "edit") {
    const read = readState([productQuery]);
    if (read === "offline") return <RouteState kind="offline" width="form" />;
    if (read === "error") {
      return <RouteState kind="error" onRetry={() => void productQuery.refetch()} width="form" />;
    }
    // A reviewed command keeps its screen: an uncertain one must stay resendable with its key.
    if (product?.status === "archived" && !command) {
      return <RouteState action={<CatalogLink />} kind="unavailable" width="form" />;
    }
    // An unproven lock waits for the history, so frozen controls never appear editable first.
    if (
      !product ||
      initializedProduct !== product.id ||
      (historyRead === "loading" && !historyLocked)
    ) {
      return <RouteState kind="loading" variant="form" width="form" />;
    }
  }

  const isStale = hasStaleRead(
    mode === "edit" ? [businesses, categories, productQuery] : [businesses, categories],
  );
  const choices = categoryChoices(categories);
  // Frozen fields show and send the product's values, also when a conflict revealed new history.
  const effectiveDraft =
    original && historyLocked ? withFrozenHistoryFields(draft, original) : draft;

  const prepareReview = () => {
    if (isStale || locked || command) return;
    if (effectiveDraft.categoryId && !choices.names.has(effectiveDraft.categoryId)) {
      setErrors({ form: t("catalog.form.categoriesUnavailable") });
      return;
    }
    const result = buildProductCommand({
      currencyMinorUnitDigits: business.currencyMinorUnitDigits,
      draft: effectiveDraft,
      idempotencyKey: Crypto.randomUUID(),
      mode,
      original,
    });
    if ("errors" in result) {
      setErrors(
        localizedErrors(
          result.errors,
          {
            price: business.currencyMinorUnitDigits,
            quantity: effectiveDraft.quantityPrecision,
          },
          t,
        ),
      );
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
      draft={effectiveDraft}
      errors={errors}
      fieldRefs={fieldRefs}
      historyLocked={historyLocked}
      isRefreshing={
        businesses.isFetching ||
        categories.isFetching ||
        (mode === "edit" && productQuery.isFetching)
      }
      isStale={isStale}
      mode={mode}
      mutationMessage={
        mutation.error && command
          ? productSaveMessage(mutation.error, command, original, t)
          : undefined
      }
      onCancel={() => {
        if (locked) return;
        router.replace(original ? productHref(original.id) : "/operate/catalog");
      }}
      onConfirm={() => {
        if (!command || phase === "pending") return;
        // The same command may always be sent again; only a first attempt needs fresh data.
        if (phase === "uncertain" || !isStale) mutation.send(command);
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
        // The review that held focus is gone; the form continues at its first field.
        pendingFocus.current = "name";
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
