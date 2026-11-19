import type { ProductDetail } from "@pisto/contracts";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ChevronRight, Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { SearchField } from "@/components/ui/search-field";
import { Text } from "@/components/ui/text";
import { productPrice, quantityText } from "@/features/catalog/format";
import { productsInfiniteOptions } from "@/features/catalog/queries";
import { requireSupportedLocale } from "@/i18n/locale";
import { flattenPages } from "@/lib/pages";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/lib/use-debounced-value";

const VISIBLE_RESULTS = 6;

type ProductSearchProps = {
  businessId: string;
  disabled: boolean;
  onAdd: (detail: ProductDetail, search: string) => void;
  selectedIds?: ReadonlySet<string>;
  initialSearch?: string;
  viewOnly?: boolean;
  onResolveInitial?: (detail: ProductDetail) => void;
};

/** Finds active products by name or SKU and adds the chosen one to the sale. */
export function ProductSearch({
  businessId,
  disabled,
  onAdd,
  selectedIds,
  initialSearch = "",
  viewOnly = false,
  onResolveInitial,
}: ProductSearchProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const [search, setSearch] = useState(initialSearch);
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const results = useInfiniteQuery({
    ...productsInfiniteOptions(businessId, { categoryId: null, search: query, status: "active" }),
    enabled: query.length > 0,
    placeholderData: undefined,
    ...(onResolveInitial && { refetchOnMount: "always" as const }),
  });
  const items = flattenPages(results.data).slice(0, VISIBLE_RESULTS);
  const searching = search.trim().length > 0;
  const pendingTerm = query !== search.trim();
  const firstPage = results.data?.pages[0];
  const unique =
    initialSearch &&
    search === initialSearch &&
    !pendingTerm &&
    results.isFetchedAfterMount &&
    !results.isError &&
    results.fetchStatus === "idle" &&
    firstPage?.nextCursor === null &&
    firstPage.items.length === 1
      ? firstPage.items[0]
      : undefined;
  useEffect(() => {
    if (unique && onResolveInitial) onResolveInitial(unique);
  }, [unique, onResolveInitial]);

  return (
    <View className="min-w-0 gap-2">
      <SearchField
        busy={search.trim() !== query || results.isFetching}
        clearLabel={t("sales.itemized.searchClear")}
        label={t("sales.itemized.searchLabel")}
        maxLength={120}
        onChangeText={setSearch}
        placeholder={t("sales.itemized.searchPlaceholder")}
        value={search}
      />
      {searching ? (
        <View
          accessibilityLabel={t("sales.itemized.searchResultsLabel")}
          className="overflow-hidden rounded-md border border-border bg-card"
          role="list"
        >
          {pendingTerm ? (
            <Text className="px-3 py-2.5 text-dense text-muted-foreground">
              {t("sales.itemized.searchLoading")}
            </Text>
          ) : results.isError || results.fetchStatus === "paused" ? (
            <View className="gap-1 p-2">
              <Text className="px-3 py-2.5 text-dense text-destructive">
                {t("sales.itemized.searchUnavailable")}
              </Text>
              <Button
                label={t("common.retry")}
                onPress={() => void results.refetch()}
                size="sm"
                variant="outline"
              />
            </View>
          ) : results.data === undefined ? (
            <Text className="px-3 py-2.5 text-dense text-muted-foreground">
              {t("sales.itemized.searchLoading")}
            </Text>
          ) : items.length === 0 ? (
            <Text className="px-3 py-2.5 text-dense text-muted-foreground">
              {t("sales.itemized.searchEmpty")}
            </Text>
          ) : (
            items.map((detail, index) => {
              const { product, stock } = detail;
              const price = productPrice(product, locale);
              const added = selectedIds?.has(product.id);
              return (
                <View key={product.id} role="listitem">
                  <PressableSurface
                    accessibilityHint={added ? t("sales.itemized.alreadyAdded") : undefined}
                    accessibilityLabel={
                      product.sku
                        ? t(
                            viewOnly
                              ? "sales.itemized.viewProductSku"
                              : "sales.itemized.addProductSku",
                            { product: product.name, sku: product.sku },
                          )
                        : t(viewOnly ? "sales.itemized.viewProduct" : "sales.itemized.addProduct", {
                            product: product.name,
                          })
                    }
                    accessibilityRole="button"
                    className={
                      index === 0
                        ? "flex-row items-center gap-3 px-3 py-2"
                        : "flex-row items-center gap-3 border-t border-border px-3 py-2"
                    }
                    disabled={disabled}
                    onPress={() => {
                      onAdd(detail, search.trim());
                      setSearch("");
                    }}
                  >
                    <View className="min-w-0 flex-1">
                      <Text className="text-sm leading-5" numberOfLines={1}>
                        {product.name}
                      </Text>
                      {product.sku && (
                        <Text className="text-xs text-muted-foreground">{product.sku}</Text>
                      )}
                      {stock ? (
                        <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
                          {t("sales.itemized.stockLeft", {
                            quantity: quantityText(t, locale, {
                              minorUnits: stock.onHandMinorUnits,
                              precision: stock.quantityPrecision,
                              unitKind: product.unitKind,
                            }),
                          })}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="font-ui text-dense tabular-nums text-muted-foreground">
                      {price ?? t("sales.itemized.noPrice")}
                    </Text>
                    <Icon
                      as={viewOnly ? ChevronRight : Plus}
                      className="text-muted-foreground"
                      size={16}
                    />
                  </PressableSurface>
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}
