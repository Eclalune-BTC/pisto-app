import { ChevronRight, Plus, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";

import type { ReceivablesCopy, ReceivablesLoadState } from "./types";

type ReceivableFilter = "all" | "open" | "overdue" | "paid" | "voided";

type ReceivablesScreenProps = {
  canManage: boolean;
  copy: ReceivablesCopy;
  customerNameFor: (customerId: string) => string;
  filter: ReceivableFilter;
  formatDate: (date: string) => string;
  formatMoney: (minorUnits: string, currency: string, digits: number) => string;
  onCreate: () => void;
  onFilterChange: (filter: ReceivableFilter) => void;
  onLoadMore: () => void;
  onOpenReceivable: (receivableId: string) => void;
  onRetry: () => void;
  state: ReceivablesLoadState;
};

export function ReceivablesScreen({
  canManage,
  copy,
  customerNameFor,
  filter,
  formatDate,
  formatMoney,
  onCreate,
  onFilterChange,
  onLoadMore,
  onOpenReceivable,
  onRetry,
  state,
}: ReceivablesScreenProps) {
  const successful = state.kind === "empty" || state.kind === "ready";
  const summary = successful ? state.summary : null;
  const filterLabels: Record<ReceivableFilter, string> = {
    all: copy.all,
    open: copy.open,
    overdue: copy.overdue,
    paid: copy.paid,
    voided: copy.voided,
  };
  return (
    <Page contentContainerClassName="gap-8">
      <ScreenHeader
        action={
          canManage && successful ? (
            <Button onPress={onCreate} variant="accent">
              <Plus color="#14241D" size={18} />
              <ButtonText variant="accent">{copy.charge}</ButtonText>
            </Button>
          ) : undefined
        }
        description={copy.description}
        title={copy.title}
      />
      {summary ? (
        <View className="gap-5 border-y border-line py-6 lg:flex-row dark:border-[#304239]">
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
              {copy.outstanding}
            </Text>
            <Text className="text-3xl font-black text-ink dark:text-white">
              {formatMoney(
                summary.outstandingMinorUnits,
                summary.currency,
                summary.currencyMinorUnitDigits,
              )}
            </Text>
            <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
              {copy.openCount}: {summary.openReceivableCount}
            </Text>
          </View>
          <View className="min-w-0 flex-1 gap-1 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 dark:border-[#304239]">
            <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
              {copy.overdue}
            </Text>
            <Text className="text-2xl font-black text-danger dark:text-[#FFBABA]">
              {formatMoney(
                summary.overdueMinorUnits,
                summary.currency,
                summary.currencyMinorUnitDigits,
              )}
            </Text>
            <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
              {copy.overdueCount}: {summary.overdueReceivableCount}
            </Text>
          </View>
        </View>
      ) : null}
      {successful ? (
        <View
          accessibilityLabel={copy.filterLabel}
          className="flex-row flex-wrap border-b border-line dark:border-[#304239]"
        >
          {(Object.keys(filterLabels) as ReceivableFilter[]).map((value) => (
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
      ) : null}
      {successful && state.stale ? (
        <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
          <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
        </View>
      ) : null}
      {state.kind === "loading" ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-line dark:border-[#304239]">
          <ActivityIndicator color="#237A55" />
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.loading}</Text>
        </View>
      ) : state.kind === "offline" || state.kind === "denied" || state.kind === "error" ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
            {state.kind === "offline"
              ? copy.offlineTitle
              : state.kind === "denied"
                ? copy.deniedTitle
                : copy.errorTitle}
          </Text>
          <Text className="max-w-[540px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {state.kind === "offline"
              ? copy.offlineDescription
              : state.kind === "denied"
                ? copy.deniedDescription
                : copy.errorDescription}
          </Text>
          {state.kind === "error" ? (
            <Button label={copy.retry} onPress={onRetry} variant="secondary" />
          ) : null}
        </View>
      ) : state.kind === "empty" ? (
        <View className="min-h-48 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
            {copy.emptyTitle}
          </Text>
          <Text className="max-w-[540px] text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {copy.emptyDescription}
          </Text>
          {canManage ? (
            <Button label={copy.emptyAction} onPress={onCreate} variant="secondary" />
          ) : null}
        </View>
      ) : (
        <View className="gap-4">
          <View className="border-t border-line dark:border-[#304239]">
            {state.items.map((item) => (
              <Pressable
                accessibilityRole="button"
                className="min-h-20 flex-row items-center gap-4 border-b border-line py-4 active:opacity-70 dark:border-[#304239]"
                key={item.id}
                onPress={() => onOpenReceivable(item.id)}
              >
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-base font-black text-ink dark:text-white">
                    {customerNameFor(item.customerId)}
                  </Text>
                  <Text className="font-bold text-ink dark:text-white">{item.description}</Text>
                  <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                    {copy.postedDate}: {formatDate(item.postedDate)}
                  </Text>
                  <Text className="text-sm font-semibold text-ink-muted dark:text-[#AAB8B0]">
                    {filterLabels[item.state]}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="font-black text-ink dark:text-white">
                    {formatMoney(
                      item.outstandingMinorUnits,
                      item.currency,
                      item.currencyMinorUnitDigits,
                    )}
                  </Text>
                  <ChevronRight color="#617168" size={18} />
                </View>
              </Pressable>
            ))}
          </View>
          {state.nextCursor ? (
            <Button disabled={state.loadingMore} onPress={onLoadMore} variant="secondary">
              {state.loadingMore ? (
                <ActivityIndicator color="#14241D" />
              ) : (
                <>
                  <RefreshCw color="#14241D" size={17} />
                  <ButtonText variant="secondary">{copy.loadMore}</ButtonText>
                </>
              )}
            </Button>
          ) : null}
        </View>
      )}
    </Page>
  );
}
