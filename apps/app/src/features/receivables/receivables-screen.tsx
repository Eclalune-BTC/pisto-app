import { ChevronRight, Plus } from "lucide-react-native";
import { ActivityIndicator, Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";

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
            <Text className="text-3xl font-black text-foreground">
              {formatMoney(
                summary.outstandingMinorUnits,
                summary.currency,
                summary.currencyMinorUnitDigits,
              )}
            </Text>
            <Text className="text-sm text-muted-foreground">
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
            <Text className="text-sm text-muted-foreground">
              {copy.overdueCount}: {summary.overdueReceivableCount}
            </Text>
          </View>
        </View>
      ) : null}
      {state.kind !== "denied" ? (
        <FilterBar
          label={copy.filterLabel}
          onChange={onFilterChange}
          options={(Object.keys(filterLabels) as ReceivableFilter[]).map((value) => ({
            label: filterLabels[value],
            value,
          }))}
          value={filter}
        />
      ) : null}
      {successful && state.stale ? (
        <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
          <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
        </View>
      ) : null}
      {state.kind === "loading" ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-border">
          <ActivityIndicator color="#237A55" />
          <Text className="text-sm text-muted-foreground">{copy.loading}</Text>
        </View>
      ) : state.kind === "offline" || state.kind === "denied" || state.kind === "error" ? (
        <View className="min-h-56 items-start justify-center gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-xl font-black text-foreground">
            {state.kind === "offline"
              ? copy.offlineTitle
              : state.kind === "denied"
                ? copy.deniedTitle
                : copy.errorTitle}
          </Text>
          <Text className="max-w-[540px] text-sm leading-5 text-muted-foreground">
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
          <Text accessibilityRole="header" className="text-xl font-black text-foreground">
            {copy.emptyTitle}
          </Text>
          <Text className="max-w-[540px] text-sm leading-5 text-muted-foreground">
            {copy.emptyDescription}
          </Text>
          {canManage ? (
            <Button label={copy.emptyAction} onPress={onCreate} variant="secondary" />
          ) : null}
        </View>
      ) : (
        <View className="gap-4">
          <View className="border-t border-border">
            {state.items.map((item) => (
              <Button
                className="min-h-20 justify-start gap-4 rounded-none border-b border-line px-0 py-4 dark:border-[#304239]"
                key={item.id}
                onPress={() => onOpenReceivable(item.id)}
                variant="ghost"
              >
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="text-base font-black text-foreground">
                    {customerNameFor(item.customerId)}
                  </Text>
                  <Text className="font-bold text-foreground">{item.description}</Text>
                  <Text className="text-sm text-muted-foreground">
                    {copy.postedDate}: {formatDate(item.postedDate)}
                  </Text>
                  <Text className="text-sm font-semibold text-muted-foreground">
                    {filterLabels[item.state]}
                  </Text>
                </View>
                <View className="items-end gap-1">
                  <Text className="font-black text-foreground">
                    {formatMoney(
                      item.outstandingMinorUnits,
                      item.currency,
                      item.currencyMinorUnitDigits,
                    )}
                  </Text>
                  <ChevronRight color="#617168" size={18} />
                </View>
              </Button>
            ))}
          </View>
          {state.nextCursor ? (
            <Button
              label={copy.loadMore}
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
