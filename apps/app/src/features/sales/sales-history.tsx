import type { Sale, SaleStatusFilter } from "@pisto/contracts";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";

import type { SalesHistoryState } from "./state";
import { saleStatusFilters } from "./state";

export type SalesHistoryCopy = {
  deniedDescription: string;
  deniedTitle: string;
  description: string;
  emptyDescription: string;
  emptyTitle: string;
  filterLabel: string;
  loadMore: string;
  loading: string;
  loadingMore: string;
  noDescription: string;
  offlineTitle: string;
  posted: string;
  retry: string;
  stale: string;
  statusAll: string;
  statusPosted: string;
  statusVoided: string;
  title: string;
  unavailableTitle: string;
  voidReason: string;
  voided: string;
  correct: string;
};

type SalesHistoryProps = {
  copy: SalesHistoryCopy;
  filter: SaleStatusFilter;
  formatDateTime: (value: string) => string;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  formatQueriedAt: (value: string) => string;
  onCorrectSale: (saleId: string) => void;
  onFilterChange: (filter: SaleStatusFilter) => void;
  onLoadMore: () => void;
  onOpenSale: (saleId: string) => void;
  onRetry: () => void;
  state: SalesHistoryState;
};

function SaleRow({
  copy,
  canCorrect,
  formatDateTime,
  formatMoney,
  onCorrectSale,
  onOpenSale,
  sale,
}: {
  copy: SalesHistoryCopy;
  canCorrect: boolean;
  formatDateTime: (value: string) => string;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onCorrectSale: (saleId: string) => void;
  onOpenSale: (saleId: string) => void;
  sale: Sale;
}) {
  const amount = formatMoney(sale.grossMinorUnits, sale.currency, sale.currencyMinorUnitDigits);
  const statusLabel = sale.status === "posted" ? copy.posted : copy.voided;
  const description = sale.description ?? copy.noDescription;
  return (
    <View className="gap-3 border-b border-line py-4 dark:border-[#304239] sm:flex-row sm:items-start sm:justify-between">
      <Pressable
        accessibilityLabel={`${description}, ${amount}, ${statusLabel}`}
        accessibilityRole="button"
        className="min-h-11 min-w-0 flex-1 justify-center gap-1 active:opacity-70"
        onPress={() => onOpenSale(sale.id)}
      >
        <Text className="font-bold text-ink dark:text-white">{description}</Text>
        <Text className="text-xs text-ink-muted dark:text-[#91A198]">
          {formatDateTime(sale.occurredAt)} · {statusLabel}
        </Text>
        {sale.status === "voided" && sale.correction ? (
          <Text className="text-xs text-ink-muted dark:text-[#91A198]">
            {copy.voidReason}: {sale.correction.reason}
          </Text>
        ) : null}
      </Pressable>
      <View className="items-start gap-2 sm:items-end">
        <Text className="font-black text-ink dark:text-white">{amount}</Text>
        {canCorrect && sale.status === "posted" && sale.correction === null ? (
          <Button
            label={copy.correct}
            onPress={() => onCorrectSale(sale.id)}
            size="sm"
            variant="secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

export function SalesHistory({
  copy,
  filter,
  formatDateTime,
  formatMoney,
  formatQueriedAt,
  onCorrectSale,
  onFilterChange,
  onLoadMore,
  onOpenSale,
  onRetry,
  state,
}: SalesHistoryProps) {
  const filterLabels: Record<SaleStatusFilter, string> = {
    all: copy.statusAll,
    posted: copy.statusPosted,
    voided: copy.statusVoided,
  };
  const answered = state.kind === "empty" || state.kind === "ready";
  return (
    <View className="gap-5">
      <View className="gap-1">
        <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
          {copy.title}
        </Text>
        <Text className="max-w-[620px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {copy.description}
        </Text>
      </View>

      <View
        accessibilityLabel={copy.filterLabel}
        className="flex-row flex-wrap border-b border-line dark:border-[#304239]"
      >
        {saleStatusFilters.map((value) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            className={`min-h-11 justify-center border-b-2 px-4 ${
              filter === value ? "border-positive" : "border-transparent"
            }`}
            key={value}
            onPress={() => onFilterChange(value)}
          >
            <Text
              className={`text-sm font-bold ${
                filter === value
                  ? "text-positive dark:text-[#8DDEAF]"
                  : "text-ink-muted dark:text-[#AAB8B0]"
              }`}
            >
              {filterLabels[value]}
            </Text>
          </Pressable>
        ))}
      </View>

      {answered && state.stale ? (
        <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
          <Text className="text-sm leading-5 text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
        </View>
      ) : null}

      {state.kind === "loading" ? (
        <View className="min-h-40 items-start justify-center gap-3 border-y border-line dark:border-[#304239]">
          <ActivityIndicator color="#237A55" />
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.loading}</Text>
        </View>
      ) : state.kind === "denied" || state.kind === "offline" || state.kind === "error" ? (
        <View className="min-h-40 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-lg font-black text-ink dark:text-white">
            {state.kind === "denied"
              ? copy.deniedTitle
              : state.kind === "offline"
                ? copy.offlineTitle
                : copy.unavailableTitle}
          </Text>
          <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {state.kind === "denied" ? copy.deniedDescription : state.message}
          </Text>
          {state.kind === "error" ? (
            <Button label={copy.retry} onPress={onRetry} variant="secondary" />
          ) : null}
        </View>
      ) : state.kind === "empty" ? (
        <View className="min-h-40 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-lg font-black text-ink dark:text-white">
            {copy.emptyTitle}
          </Text>
          <Text className="max-w-[560px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {copy.emptyDescription}
          </Text>
        </View>
      ) : (
        <View className="gap-4">
          <View className="border-t border-line dark:border-[#304239]">
            {state.items.map((sale) => (
              <SaleRow
                canCorrect={state.canCorrect}
                copy={copy}
                formatDateTime={formatDateTime}
                formatMoney={formatMoney}
                key={sale.id}
                onCorrectSale={onCorrectSale}
                onOpenSale={onOpenSale}
                sale={sale}
              />
            ))}
          </View>
          {state.hasMore ? (
            <Button
              className="self-start"
              label={state.loadingMore ? copy.loadingMore : copy.loadMore}
              loading={state.loadingMore}
              onPress={onLoadMore}
              variant="secondary"
            />
          ) : null}
        </View>
      )}

      {answered ? (
        <Text className="text-xs leading-5 text-ink-muted dark:text-[#91A198]">
          {formatQueriedAt(state.queriedAt)}
        </Text>
      ) : null}
    </View>
  );
}
