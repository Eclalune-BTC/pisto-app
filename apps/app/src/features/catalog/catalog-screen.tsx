import type { Category, ProductDetail } from "@pisto/contracts";
import { AlertTriangle, FolderCog, Plus, Search } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Text, View } from "react-native";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { requireSupportedLocale } from "@/i18n/locale";
import { formatMinorUnits } from "@/lib/money";
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

interface CatalogScreenProps {
  canManage: boolean;
  categories: Category[];
  categoriesError: boolean;
  categoriesHasNextPage: boolean;
  categoriesLoading: boolean;
  categoriesLoadingMore: boolean;
  categoryId: string | null;
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
  onRetry,
  status,
}: {
  onRetry: () => void;
  status: "denied" | "error" | "loading" | "offline";
}) {
  const { t } = useTranslation();
  if (status === "loading") {
    return (
      <View className="min-h-56 items-start justify-center gap-3 border-y border-border">
        <ActivityIndicator color="#237A55" />
        <Text className="text-sm text-muted-foreground">{t("catalog.list.loading")}</Text>
      </View>
    );
  }
  const title =
    status === "denied"
      ? t("catalog.list.deniedTitle")
      : status === "offline"
        ? t("remote.offlineTitle")
        : t("catalog.list.errorTitle");
  const description =
    status === "denied"
      ? t("catalog.list.deniedDescription")
      : status === "offline"
        ? t("remote.offlineDescription")
        : t("catalog.list.errorDescription");
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
        <Button
          className="self-start"
          label={t("common.retry")}
          onPress={onRetry}
          variant="secondary"
        />
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
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  if (state.status === "denied") {
    return (
      <Page>
        <StatusState onRetry={onRetry} status="denied" />
      </Page>
    );
  }
  return (
    <Page contentContainerClassName="gap-8">
      <ScreenHeader
        action={
          <View className="gap-3 sm:flex-row sm:flex-wrap">
            <Button onPress={onManageCategories} variant="secondary">
              <FolderCog color="#237A55" size={18} />
              <ButtonText variant="secondary">{t("catalog.list.manageCategories")}</ButtonText>
            </Button>
            {canManage ? (
              <Button onPress={onCreateProduct} variant="accent">
                <Plus color="#14241D" size={18} strokeWidth={2.6} />
                <ButtonText variant="accent">{t("catalog.list.createProduct")}</ButtonText>
              </Button>
            ) : null}
          </View>
        }
        description={t("catalog.list.description")}
        eyebrow={t("catalog.list.eyebrow")}
        title={t("catalog.list.title")}
      />

      {showReadOnlyNotice ? (
        <ReadOnlyNotice description={t("catalog.remote.catalogReadOnly")} />
      ) : null}

      <View className="gap-5 border-y border-line py-5 dark:border-[#304239]">
        <View className="gap-4 lg:flex-row lg:items-end">
          <View className="min-w-0 flex-1">
            <Field
              accessibilityLabel={t("catalog.list.searchLabel")}
              label={t("catalog.list.searchLabel")}
              onChangeText={onSearchChange}
              placeholder={t("catalog.list.searchPlaceholder")}
              trailing={<Search color="#617168" size={18} />}
              value={search}
            />
          </View>
          <View className="gap-1 lg:max-w-[48%]">
            <Text className="text-xs font-semibold text-muted-foreground">
              {t("catalog.list.statusLabel")}
            </Text>
            <FilterBar
              label={t("catalog.list.statusLabel")}
              onChange={onStatusChange}
              options={(["active", "archived", "all"] as const).map((value) => ({
                label: t(`catalog.list.statuses.${value}`),
                value,
              }))}
              value={status}
            />
          </View>
        </View>

        <View className="gap-2">
          <FilterBar
            label={t("catalog.categories.title")}
            onChange={(value) => onCategoryChange(value === "all" ? null : value)}
            options={[
              { value: "all", label: t("catalog.list.allCategories") },
              ...categories
                .filter((category) => category.status === "active")
                .map((category) => ({ value: category.id, label: category.name })),
            ]}
            value={categoryId ?? "all"}
          />
          {categoriesLoading ? (
            <Text className="py-2 text-sm text-muted-foreground">
              {t("catalog.list.categoriesLoading")}
            </Text>
          ) : null}
          {categoriesHasNextPage ? (
            <Button
              label={t("catalog.list.loadMoreCategories")}
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
              {t("catalog.list.categoriesUnavailable")}
            </Text>
            <Button
              label={t("common.retry")}
              onPress={onRetryCategories}
              size="sm"
              variant="secondary"
            />
          </View>
        ) : null}
      </View>

      {state.status !== "ready" ? (
        <StatusState onRetry={onRetry} status={state.status} />
      ) : (
        <View className="gap-0">
          {state.stale ? (
            <View className="mb-5 border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
              <Text className="text-sm text-ink dark:text-[#F2E4D2]">{t("remote.stale")}</Text>
            </View>
          ) : null}
          {state.items.length === 0 ? (
            <View className="gap-2 py-12">
              <Text className="text-xl font-black text-foreground">
                {t("catalog.list.emptyTitle")}
              </Text>
              <Text className="max-w-[560px] text-sm leading-5 text-muted-foreground">
                {t("catalog.list.emptyDescription")}
              </Text>
              {canManage ? (
                <Button
                  className="mt-3 self-start"
                  label={t("catalog.list.createProduct")}
                  onPress={onCreateProduct}
                  variant="accent"
                />
              ) : null}
            </View>
          ) : (
            state.items.map(({ product, stock }) => (
              <Button
                accessibilityLabel={t("catalog.list.openProduct", { name: product.name })}
                className="flex-col items-stretch justify-start gap-3 rounded-none border-b border-line px-0 py-5 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between"
                key={product.id}
                onPress={() => onOpenProduct(product.id)}
                variant="ghost"
              >
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row flex-wrap items-center gap-2">
                    <Text className="text-lg font-black text-foreground">{product.name}</Text>
                    {product.status === "archived" ? (
                      <Text className="text-xs font-semibold text-danger dark:text-[#FFBABA]">
                        {t("catalog.list.archived")}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="text-sm text-muted-foreground">
                    {product.sku ?? t("catalog.list.noSku")}
                  </Text>
                </View>
                <View className="gap-1 sm:min-w-[220px] sm:items-end">
                  <Text className="font-bold text-foreground">
                    {product.sellingPriceMinorUnits === null ||
                    product.sellingPriceCurrency === null ||
                    product.sellingPriceCurrencyMinorUnitDigits === null
                      ? t("catalog.list.noPrice")
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
                        : "text-sm text-muted-foreground"
                    }
                  >
                    {stock
                      ? `${t("catalog.list.onHand")}: ${formatQuantityMinorUnits(
                          stock.onHandMinorUnits,
                          stock.quantityPrecision,
                        )} ${t(`catalog.unitLabels.${product.unitKind}`)}${stock.lowStock ? ` · ${t("catalog.list.lowStock")}` : ""}`
                      : t("catalog.list.stockNotTracked")}
                  </Text>
                </View>
              </Button>
            ))
          )}
          {state.hasNextPage ? (
            <Button
              className="mt-6 self-start"
              label={state.loadingMore ? t("catalog.list.loadingMore") : t("catalog.list.loadMore")}
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
