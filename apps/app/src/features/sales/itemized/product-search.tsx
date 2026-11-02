import type { ProductDetail } from "@pisto/contracts";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
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
  onAdd: (detail: ProductDetail) => void;
  selectedIds: ReadonlySet<string>;
};

/** Finds active products by name or SKU and adds the chosen one to the sale. */
export function ProductSearch({ businessId, disabled, onAdd, selectedIds }: ProductSearchProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const results = useInfiniteQuery({
    ...productsInfiniteOptions(businessId, { categoryId: null, search: query, status: "active" }),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });
  const items = flattenPages(results.data).slice(0, VISIBLE_RESULTS);
  const searching = query.length > 0;

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
          {results.isError && !results.data ? (
            <Text className="px-3 py-2.5 text-[13px] text-destructive">
              {t("sales.itemized.searchUnavailable")}
            </Text>
          ) : results.data === undefined ? (
            <Text className="px-3 py-2.5 text-[13px] text-muted-foreground">
              {t("sales.itemized.searchLoading")}
            </Text>
          ) : items.length === 0 ? (
            <Text className="px-3 py-2.5 text-[13px] text-muted-foreground">
              {t("sales.itemized.searchEmpty")}
            </Text>
          ) : (
            items.map((detail, index) => {
              const { product, stock } = detail;
              const price = productPrice(product, locale);
              const added = selectedIds.has(product.id);
              return (
                <PressableSurface
                  accessibilityHint={added ? t("sales.itemized.alreadyAdded") : undefined}
                  accessibilityLabel={t("sales.itemized.addProduct", { product: product.name })}
                  accessibilityRole="button"
                  className={
                    index === 0
                      ? "flex-row items-center gap-3 px-3 py-2"
                      : "flex-row items-center gap-3 border-t border-border px-3 py-2"
                  }
                  disabled={disabled}
                  key={product.id}
                  onPress={() => {
                    onAdd(detail);
                    setSearch("");
                  }}
                  role="listitem"
                >
                  <View className="min-w-0 flex-1">
                    <Text className="text-sm leading-5" numberOfLines={1}>
                      {product.name}
                    </Text>
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
                  <Text className="font-ui text-[13px] tabular-nums text-muted-foreground">
                    {price ?? t("sales.itemized.noPrice")}
                  </Text>
                  <Icon as={Plus} className="text-muted-foreground" size={16} />
                </PressableSurface>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}
