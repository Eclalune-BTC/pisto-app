import type { Product, Purchase, Supplier } from "@pisto/contracts";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { productsInfiniteOptions } from "@/features/catalog/queries";
import { useRecordFormat } from "@/features/customers/format";
import { readState } from "@/features/customers/read-state";
import { pickerStatus, RecordPicker } from "@/features/customers/record-picker";
import type { FocusReturnRef } from "@/lib/focus-return";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/lib/use-debounced-value";

import { supplierContactLine } from "./presentation";
import { purchasesQueryOptions, suppliersQueryOptions } from "./queries";

const SEARCH_MAX_LENGTH = 80;

type PickerProps<T> = {
  businessId: string;
  onOpenChange: (open: boolean) => void;
  onSelect: (choice: T) => void;
  open: boolean;
  /** The control that opened the picker; focus returns to it when the picker closes. */
  returnFocusRef?: FocusReturnRef;
  selectedId: string | null;
};

function useSearch() {
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  return { query, search, setSearch };
}

/** Active suppliers only: an archived supplier takes no new purchase. */
export function SupplierPickerDialog({
  businessId,
  onOpenChange,
  onSelect,
  open,
  returnFocusRef,
  selectedId,
}: PickerProps<Supplier>) {
  const { t } = useTranslation();
  const { query, search, setSearch } = useSearch();
  const suppliers = useInfiniteQuery({
    ...suppliersQueryOptions(businessId, {
      balance: "all",
      query: query || undefined,
      status: "active",
    }),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const read = readState([suppliers]);
  const close = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };
  return (
    <RecordPicker
      description={t("purchases.supplierPicker.description")}
      emptyText={
        query ? t("purchases.supplierPicker.noMatches") : t("purchases.supplierPicker.empty")
      }
      freshChoiceOnly
      getKey={(supplier) => supplier.id}
      hasNextPage={suppliers.hasNextPage}
      items={suppliers.data?.pages.flatMap((page) => page.items) ?? []}
      label={t("purchases.supplierPicker.title")}
      loadMoreLabel={t("common.loadMore")}
      loadingMore={suppliers.isFetchingNextPage}
      onLoadMore={() => void suppliers.fetchNextPage()}
      onOpenChange={close}
      onRetry={() => void suppliers.refetch()}
      onSelect={(supplier) => {
        onSelect(supplier);
        close(false);
      }}
      open={open}
      renderItem={(supplier) => ({
        detail: supplierContactLine(supplier),
        label: supplier.name,
      })}
      returnFocusRef={returnFocusRef}
      search={{
        busy: search.trim() !== query || suppliers.isPlaceholderData,
        label: t("purchases.supplierPicker.search"),
        maxLength: SEARCH_MAX_LENGTH,
        onChange: setSearch,
        placeholder: t("purchases.suppliers.searchPlaceholder"),
        value: search,
      }}
      selectedKey={selectedId}
      stale={read.kind === "ready" && read.stale}
      status={pickerStatus(read)}
      title={t("purchases.supplierPicker.title")}
    />
  );
}

/** Active catalog products; an archived product cannot be purchased. */
export function ProductPickerDialog({
  businessId,
  onOpenChange,
  onSelect,
  open,
  returnFocusRef,
  selectedId,
}: PickerProps<Product>) {
  const { t } = useTranslation();
  const { query, search, setSearch } = useSearch();
  const products = useInfiniteQuery({
    ...productsInfiniteOptions(businessId, { categoryId: null, search: query, status: "active" }),
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const read = readState([products]);
  const close = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };
  return (
    <RecordPicker
      description={t("purchases.productPicker.description")}
      emptyText={
        query ? t("purchases.productPicker.noMatches") : t("purchases.productPicker.empty")
      }
      freshChoiceOnly
      getKey={(product) => product.id}
      hasNextPage={products.hasNextPage}
      items={products.data?.pages.flatMap((page) => page.items.map(({ product }) => product)) ?? []}
      label={t("purchases.productPicker.title")}
      loadMoreLabel={t("common.loadMore")}
      loadingMore={products.isFetchingNextPage}
      onLoadMore={() => void products.fetchNextPage()}
      onOpenChange={close}
      onRetry={() => void products.refetch()}
      onSelect={(product) => {
        onSelect(product);
        close(false);
      }}
      open={open}
      renderItem={(product) => ({
        detail: product.sku ?? undefined,
        label: product.name,
        tag: product.tracked ? undefined : t("purchases.productPicker.untracked"),
      })}
      returnFocusRef={returnFocusRef}
      search={{
        busy: search.trim() !== query || products.isPlaceholderData,
        label: t("purchases.productPicker.search"),
        maxLength: SEARCH_MAX_LENGTH,
        onChange: setSearch,
        placeholder: t("purchases.productPicker.search"),
        value: search,
      }}
      selectedKey={selectedId}
      stale={read.kind === "ready" && read.stale}
      status={pickerStatus(read)}
      title={t("purchases.productPicker.title")}
    />
  );
}

/** Purchases that still owe money, optionally of one supplier. */
export function OpenPurchasePickerDialog({
  businessId,
  onOpenChange,
  onSelect,
  open,
  returnFocusRef,
  selectedId,
  supplierId,
}: PickerProps<Purchase> & { supplierId?: string }) {
  const { t } = useTranslation();
  const format = useRecordFormat();
  const purchases = useInfiniteQuery({
    ...purchasesQueryOptions(businessId, { payable: "open", status: "posted", supplierId }),
    enabled: open,
  });
  const read = readState([purchases]);
  return (
    <RecordPicker
      description={t("purchases.purchasePicker.description")}
      emptyText={t("purchases.purchasePicker.empty")}
      freshChoiceOnly
      getKey={(purchase) => purchase.id}
      hasNextPage={purchases.hasNextPage}
      items={purchases.data?.pages.flatMap((page) => page.items) ?? []}
      label={t("purchases.purchasePicker.title")}
      loadMoreLabel={t("common.loadMore")}
      loadingMore={purchases.isFetchingNextPage}
      onLoadMore={() => void purchases.fetchNextPage()}
      onOpenChange={onOpenChange}
      onRetry={() => void purchases.refetch()}
      onSelect={(purchase) => {
        onSelect(purchase);
        onOpenChange(false);
      }}
      open={open}
      renderItem={(purchase) => ({
        detail: t("purchases.purchasePicker.detail", {
          balance: format.money(
            purchase.balanceMinorUnits,
            purchase.currency,
            purchase.currencyMinorUnitDigits,
          ),
          date: format.date(purchase.occurredLocalDate),
        }),
        label: purchase.invoiceNumber
          ? `${purchase.supplierName} · ${purchase.invoiceNumber}`
          : purchase.supplierName,
      })}
      returnFocusRef={returnFocusRef}
      selectedKey={selectedId}
      stale={read.kind === "ready" && read.stale}
      status={pickerStatus(read)}
      title={t("purchases.purchasePicker.title")}
    />
  );
}
