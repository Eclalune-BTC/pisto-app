import { useInfiniteQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { readState } from "@/features/customers/read-state";
import { pickerStatus, RecordPicker } from "@/features/customers/record-picker";
import { requireSupportedLocale } from "@/i18n/locale";
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from "@/lib/use-debounced-value";
import { stockInfiniteOptions } from "../inventory/queries";
import { quantityText } from "./format";
import { SEARCH_MAX_LENGTH } from "./search-params";

type ReceiveStockPickerProps = {
  businessId: string;
  onOpenChange: (open: boolean) => void;
  /** Continues to the stock entry of the chosen product. */
  onSelect: (productId: string) => void;
  open: boolean;
};

/** "Registrar entrada" starts by choosing one of the active products whose stock is tracked. */
export function ReceiveStockPicker({
  businessId,
  onOpenChange,
  onSelect,
  open,
}: ReceiveStockPickerProps) {
  const { i18n, t } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const [search, setSearch] = useState("");
  const query = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const stock = useInfiniteQuery({
    ...stockInfiniteOptions(businessId, { lowStockOnly: false, search: query }),
    enabled: open,
  });
  const read = readState([stock]);
  const close = (next: boolean) => {
    if (!next) setSearch("");
    onOpenChange(next);
  };
  return (
    <RecordPicker
      description={t("catalog.receivePicker.description")}
      emptyText={query ? t("catalog.list.emptyFilteredTitle") : t("catalog.receivePicker.empty")}
      freshChoiceOnly={false}
      getKey={(item) => item.product.id}
      hasNextPage={stock.hasNextPage}
      items={stock.data?.pages.flatMap((page) => page.items) ?? []}
      label={t("catalog.receivePicker.title")}
      loadMoreLabel={t("common.loadMore")}
      loadingMore={stock.isFetchingNextPage}
      onLoadMore={() => void stock.fetchNextPage()}
      onOpenChange={close}
      onRetry={() => void stock.refetch()}
      onSelect={(item) => {
        close(false);
        onSelect(item.product.id);
      }}
      open={open}
      renderItem={(item) => ({
        detail: t("catalog.receivePicker.onHand", {
          quantity: quantityText(t, locale, {
            minorUnits: item.stock.onHandMinorUnits,
            precision: item.stock.quantityPrecision,
            unitKind: item.product.unitKind,
          }),
        }),
        label: item.product.name,
      })}
      search={{
        busy: search.trim() !== query || stock.isPlaceholderData,
        label: t("catalog.list.searchLabel"),
        maxLength: SEARCH_MAX_LENGTH,
        onChange: setSearch,
        placeholder: t("catalog.list.searchPlaceholder"),
        value: search,
      }}
      selectedKey={null}
      stale={read.kind === "ready" && read.stale}
      status={pickerStatus(read)}
      title={t("catalog.receivePicker.title")}
    />
  );
}
