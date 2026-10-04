import type { Category, ProductDetail } from "@pisto/contracts";
import { AlertTriangle, Search } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useCSSVariable } from "uniwind";
import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Field } from "@/components/ui/field";
import { FilterBar } from "@/components/ui/filter-bar";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
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
        <LoadingIndicator />
        <Text className="font-sans text-sm text-muted-foreground">{t("catalog.list.loading")}</Text>
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
    <Alert icon={AlertTriangle} variant="destructive">
      <AlertTitle className="leading-6">{title}</AlertTitle>
      <AlertDescription>{description}</AlertDescription>
      {status === "error" ? (
        <Button
          className="mb-2 ml-6 mt-2 self-start"
          label={t("common.retry")}
          onPress={onRetry}
          variant="outline"
        />
      ) : null}
    </Alert>
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
  const mutedColor = useCSSVariable("--color-muted-foreground") as string;
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const columns = useMemo<DataTableColumn<ProductDetail>[]>(
    () => [
      {
        id: "name",
        header: t("dataTable.columns.name"),
        meta: { primary: true },
        cell: ({
          row: {
            original: { product },
          },
        }) => (
          <Button
            accessibilityLabel={t("dataTable.openRecord", { name: product.name })}
            className="justify-start px-0"
            label={product.name}
            onPress={() => onOpenProduct(product.id)}
            size="sm"
            variant="ghost"
          />
        ),
      },
      {
        id: "sku",
        header: t("dataTable.columns.sku"),
        cell: ({
          row: {
            original: { product },
          },
        }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {product.sku ?? t("catalog.list.noSku")}
          </Text>
        ),
      },
      {
        id: "price",
        header: t("dataTable.columns.price"),
        meta: { align: "end" },
        cell: ({
          row: {
            original: { product },
          },
        }) => (
          <Text className="font-ui text-sm text-foreground">
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
        ),
      },
      {
        id: "stock",
        header: t("dataTable.columns.stock"),
        meta: { align: "end" },
        cell: ({
          row: {
            original: { product, stock },
          },
        }) => (
          <Text
            className={
              stock?.lowStock
                ? "font-ui text-sm text-destructive"
                : "font-sans text-sm text-foreground"
            }
          >
            {stock
              ? `${formatQuantityMinorUnits(stock.onHandMinorUnits, stock.quantityPrecision)} ${t(`catalog.unitLabels.${product.unitKind}`)}${stock.lowStock ? ` · ${t("catalog.list.lowStock")}` : ""}`
              : t("catalog.list.stockNotTracked")}
          </Text>
        ),
      },
      {
        id: "status",
        header: t("dataTable.columns.status"),
        cell: ({
          row: {
            original: { product },
          },
        }) => (
          <Text className="font-sans text-sm text-muted-foreground">
            {product.status === "archived"
              ? t("catalog.list.archived")
              : t("catalog.productDetail.active")}
          </Text>
        ),
      },
    ],
    [locale, onOpenProduct, t],
  );
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
            <Button
              label={t("catalog.list.manageCategories")}
              onPress={onManageCategories}
              variant="outline"
            />
            {canManage ? (
              <Button
                label={t("catalog.list.createProduct")}
                onPress={onCreateProduct}
                variant="default"
              />
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

      <FilterToolbar label={t("catalog.list.statusLabel")}>
        <View className="min-w-0 sm:min-w-56 sm:flex-1">
          <Field
            accessibilityLabel={t("catalog.list.searchLabel")}
            label={t("catalog.list.searchLabel")}
            onChangeText={onSearchChange}
            placeholder={t("catalog.list.searchPlaceholder")}
            trailing={<Search color={mutedColor} size={18} />}
            value={search}
          />
        </View>
        <View className="min-w-0 sm:min-w-72 sm:flex-1">
          <FilterBar
            showLabel
            label={t("catalog.list.statusLabel")}
            onChange={onStatusChange}
            options={(["active", "archived", "all"] as const).map((value) => ({
              label: t(`catalog.list.statuses.${value}`),
              value,
            }))}
            value={status}
          />
        </View>
        <View className="min-w-0 sm:min-w-56 sm:flex-1 gap-2">
          <SelectField
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
            <Text className="font-sans py-2 text-sm text-muted-foreground">
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
          <View className="gap-2 border-l-4 border-warning bg-muted p-3 sm:flex-row sm:items-center sm:justify-between">
            <Text accessibilityRole="alert" className="font-sans text-sm text-foreground">
              {t("catalog.list.categoriesUnavailable")}
            </Text>
            <Button
              label={t("common.retry")}
              onPress={onRetryCategories}
              size="sm"
              variant="outline"
            />
          </View>
        ) : null}
      </FilterToolbar>

      {state.status !== "ready" ? (
        <StatusState onRetry={onRetry} status={state.status} />
      ) : (
        <View className="gap-0">
          {state.stale ? (
            <View className="mb-5 border-l-4 border-warning bg-muted p-3">
              <Text className="font-sans text-sm text-foreground">{t("remote.stale")}</Text>
            </View>
          ) : null}
          {state.items.length === 0 ? (
            <EmptyState
              title={t("catalog.list.emptyTitle")}
              description={t("catalog.list.emptyDescription")}
              action={
                canManage ? (
                  <Button
                    className="self-start"
                    label={t("catalog.list.createProduct")}
                    onPress={onCreateProduct}
                    variant="default"
                  />
                ) : undefined
              }
            />
          ) : (
            <DataTable
              caption={t("catalog.list.title")}
              columns={columns}
              data={state.items}
              getRowId={({ product }) => product.id}
            />
          )}
          {state.hasNextPage ? (
            <Button
              className="mt-6 self-start"
              label={state.loadingMore ? t("catalog.list.loadingMore") : t("catalog.list.loadMore")}
              loading={state.loadingMore}
              onPress={onLoadMore}
              variant="outline"
            />
          ) : null}
        </View>
      )}
    </Page>
  );
}
