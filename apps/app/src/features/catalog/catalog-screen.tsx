import { AlertTriangle, FolderCog, Plus, Search } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { formatMinorUnits } from "@/lib/money";
import type {
  Category,
  ProductDetail,
  ProductUnitKind,
} from "../../../../../packages/contracts/src/catalog";
import { formatQuantityMinorUnits } from "../inventory/quantity";
import type { CatalogStatusFilter } from "./query-keys";
import { ReadOnlyNotice } from "./route-state";

export type CatalogCollectionState =
  | { status: "loading" }
  | { status: "offline" }
  | { status: "denied" }
  | { status: "error" }
  | {
      status: "ready";
      hasNextPage: boolean;
      items: ProductDetail[];
      loadingMore: boolean;
      stale?: boolean;
    };

export interface CatalogScreenCopy {
  title: string;
  description: string;
  eyebrow: string;
  createProduct: string;
  manageCategories: string;
  searchLabel: string;
  searchPlaceholder: string;
  allCategories: string;
  statusLabel: string;
  statuses: Record<CatalogStatusFilter, string>;
  loading: string;
  offlineTitle: string;
  offlineDescription: string;
  deniedTitle: string;
  deniedDescription: string;
  errorTitle: string;
  errorDescription: string;
  retry: string;
  stale: string;
  emptyTitle: string;
  emptyDescription: string;
  archived: string;
  noSku: string;
  noPrice: string;
  stockNotTracked: string;
  lowStock: string;
  onHand: string;
  loadMore: string;
  loadingMore: string;
  loadMoreCategories: string;
  categoriesLoading: string;
  categoriesUnavailable: string;
  readOnlyTitle: string;
  readOnlyDescription: string;
  unitLabels: Record<ProductUnitKind, string>;
  openProduct: (name: string) => string;
}

interface CatalogScreenProps {
  canManage: boolean;
  categories: Category[];
  categoriesError: boolean;
  categoriesHasNextPage: boolean;
  categoriesLoading: boolean;
  categoriesLoadingMore: boolean;
  categoryId: string | null;
  copy: CatalogScreenCopy;
  locale: string;
  onCategoryChange: (categoryId: string | null) => void;
  onCreateProduct: () => void;
  onLoadMore: () => void;
  onLoadMoreCategories: () => void;
  onManageCategories: () => void;
  onOpenProduct: (productId: string) => void;
  onRetry: () => void;
  onRetryCategories: () => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (status: CatalogStatusFilter) => void;
  search: string;
  showReadOnlyNotice: boolean;
  state: CatalogCollectionState;
  status: CatalogStatusFilter;
}

function StatusState({
  copy,
  onRetry,
  status,
}: {
  copy: CatalogScreenCopy;
  onRetry: () => void;
  status: "denied" | "error" | "loading" | "offline";
}) {
  if (status === "loading") {
    return (
      <View className="min-h-56 items-start justify-center gap-3 border-y border-line dark:border-[#304239]">
        <ActivityIndicator color="#237A55" />
        <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.loading}</Text>
      </View>
    );
  }
  const title =
    status === "denied"
      ? copy.deniedTitle
      : status === "offline"
        ? copy.offlineTitle
        : copy.errorTitle;
  const description =
    status === "denied"
      ? copy.deniedDescription
      : status === "offline"
        ? copy.offlineDescription
        : copy.errorDescription;
  return (
    <View className="gap-4 border-l-4 border-danger bg-[#FFF1F1] p-5 dark:bg-[#3A2020]">
      <View className="flex-row items-start gap-3">
        <AlertTriangle color="#B94242" size={20} />
        <View className="min-w-0 flex-1 gap-1">
          <Text accessibilityRole="alert" className="font-bold text-danger dark:text-[#FFBABA]">
            {title}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#C9D4CE]">
            {description}
          </Text>
        </View>
      </View>
      {status === "error" ? (
        <Button className="self-start" label={copy.retry} onPress={onRetry} variant="secondary" />
      ) : null}
    </View>
  );
}

export function CatalogScreen({
  canManage,
  categories,
  categoriesError,
  categoriesHasNextPage,
  categoriesLoading,
  categoriesLoadingMore,
  categoryId,
  copy,
  locale,
  onCategoryChange,
  onCreateProduct,
  onLoadMore,
  onLoadMoreCategories,
  onManageCategories,
  onOpenProduct,
  onRetry,
  onRetryCategories,
  onSearchChange,
  onStatusChange,
  search,
  showReadOnlyNotice,
  state,
  status,
}: CatalogScreenProps) {
  return (
    <Page contentContainerClassName="gap-8">
      <ScreenHeader
        action={
          <View className="gap-3 sm:flex-row">
            <Button onPress={onManageCategories} variant="secondary">
              <FolderCog color="#237A55" size={18} />
              <ButtonText variant="secondary">{copy.manageCategories}</ButtonText>
            </Button>
            {canManage ? (
              <Button onPress={onCreateProduct} variant="accent">
                <Plus color="#14241D" size={18} strokeWidth={2.6} />
                <ButtonText variant="accent">{copy.createProduct}</ButtonText>
              </Button>
            ) : null}
          </View>
        }
        description={copy.description}
        eyebrow={copy.eyebrow}
        title={copy.title}
      />

      {showReadOnlyNotice ? <ReadOnlyNotice description={copy.readOnlyDescription} /> : null}

      <View className="gap-5 border-y border-line py-5 dark:border-[#304239]">
        <View className="gap-4 lg:flex-row lg:items-end">
          <View className="min-w-0 flex-1">
            <Field
              accessibilityLabel={copy.searchLabel}
              label={copy.searchLabel}
              onChangeText={onSearchChange}
              placeholder={copy.searchPlaceholder}
              trailing={<Search color="#617168" size={18} />}
              value={search}
            />
          </View>
          <View className="gap-1 lg:max-w-[48%]">
            <Text className="text-xs font-semibold text-ink-muted dark:text-[#AAB8B0]">
              {copy.statusLabel}
            </Text>
            <View accessibilityRole="tablist" className="flex-row flex-wrap gap-x-5 gap-y-1">
              {(["active", "archived", "all"] as const).map((value) => (
                <Pressable
                  accessibilityRole="tab"
                  accessibilityState={{ selected: status === value }}
                  className={status === value ? "border-b-2 border-positive py-2" : "py-2"}
                  key={value}
                  onPress={() => onStatusChange(value)}
                >
                  <Text className="font-semibold text-ink dark:text-white">
                    {copy.statuses[value]}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        <View
          accessibilityRole="tablist"
          className="flex-row flex-wrap items-center gap-x-5 gap-y-2"
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: categoryId === null }}
            className={categoryId === null ? "border-b-2 border-positive py-2" : "py-2"}
            onPress={() => onCategoryChange(null)}
          >
            <Text className="font-semibold text-ink dark:text-white">{copy.allCategories}</Text>
          </Pressable>
          {categories
            .filter((category) => category.status === "active")
            .map((category) => (
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: categoryId === category.id }}
                className={categoryId === category.id ? "border-b-2 border-positive py-2" : "py-2"}
                key={category.id}
                onPress={() => onCategoryChange(category.id)}
              >
                <Text className="font-semibold text-ink dark:text-white">{category.name}</Text>
              </Pressable>
            ))}
          {categoriesLoading ? (
            <Text className="py-2 text-sm text-ink-muted dark:text-[#AAB8B0]">
              {copy.categoriesLoading}
            </Text>
          ) : null}
          {categoriesHasNextPage ? (
            <Button
              label={copy.loadMoreCategories}
              loading={categoriesLoadingMore}
              onPress={onLoadMoreCategories}
              size="sm"
              variant="ghost"
            />
          ) : null}
        </View>
        {categoriesError ? (
          <View className="gap-2 border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18] sm:flex-row sm:items-center sm:justify-between">
            <Text accessibilityRole="alert" className="text-sm text-ink dark:text-[#F2E4D2]">
              {copy.categoriesUnavailable}
            </Text>
            <Button label={copy.retry} onPress={onRetryCategories} size="sm" variant="secondary" />
          </View>
        ) : null}
      </View>

      {state.status !== "ready" ? (
        <StatusState copy={copy} onRetry={onRetry} status={state.status} />
      ) : (
        <View className="gap-0">
          {state.stale ? (
            <View className="mb-5 border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
              <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
            </View>
          ) : null}
          {state.items.length === 0 ? (
            <View className="gap-2 py-12">
              <Text className="text-xl font-black text-ink dark:text-white">{copy.emptyTitle}</Text>
              <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
                {copy.emptyDescription}
              </Text>
              {canManage ? (
                <Button
                  className="mt-3 self-start"
                  label={copy.createProduct}
                  onPress={onCreateProduct}
                  variant="accent"
                />
              ) : null}
            </View>
          ) : (
            state.items.map(({ product, stock }) => (
              <Pressable
                accessibilityLabel={copy.openProduct(product.name)}
                accessibilityRole="button"
                className="gap-3 border-b border-line py-5 active:opacity-70 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between"
                key={product.id}
                onPress={() => onOpenProduct(product.id)}
              >
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-lg font-black text-ink dark:text-white">
                      {product.name}
                    </Text>
                    {product.status === "archived" ? (
                      <Text className="text-xs font-semibold text-danger dark:text-[#FFBABA]">
                        {copy.archived}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                    {product.sku ?? copy.noSku}
                  </Text>
                </View>
                <View className="gap-1 sm:min-w-[220px] sm:items-end">
                  <Text className="font-bold text-ink dark:text-white">
                    {product.sellingPriceMinorUnits === null ||
                    product.sellingPriceCurrency === null ||
                    product.sellingPriceCurrencyMinorUnitDigits === null
                      ? copy.noPrice
                      : formatMinorUnits(
                          product.sellingPriceMinorUnits,
                          product.sellingPriceCurrency,
                          product.sellingPriceCurrencyMinorUnitDigits,
                          locale,
                        )}
                  </Text>
                  <Text
                    className={
                      stock?.lowStock
                        ? "text-sm font-semibold text-danger dark:text-[#FFBABA]"
                        : "text-sm text-ink-muted dark:text-[#AAB8B0]"
                    }
                  >
                    {stock
                      ? `${copy.onHand}: ${formatQuantityMinorUnits(
                          stock.onHandMinorUnits,
                          stock.quantityPrecision,
                        )} ${copy.unitLabels[product.unitKind]}${stock.lowStock ? ` · ${copy.lowStock}` : ""}`
                      : copy.stockNotTracked}
                  </Text>
                </View>
              </Pressable>
            ))
          )}
          {state.hasNextPage ? (
            <Button
              className="mt-6 self-start"
              label={state.loadingMore ? copy.loadingMore : copy.loadMore}
              loading={state.loadingMore}
              onPress={onLoadMore}
              variant="secondary"
            />
          ) : null}
        </View>
      )}
    </Page>
  );
}
