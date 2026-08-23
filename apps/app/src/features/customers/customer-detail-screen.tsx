import { Archive, ArrowLeft, Pencil } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Page } from "@/components/page";
import { ScreenHeader } from "@/components/screen-header";
import { Button, ButtonText } from "@/components/ui/button";

import type { CustomerDetailLoadState, CustomersCopy } from "./types";

type CustomerDetailScreenProps = {
  canManage: boolean;
  copy: CustomersCopy;
  formatDate: (date: string) => string;
  formatMoney: (minorUnits: string, currency: string, digits: number) => string;
  onArchive: () => void;
  onBack: () => void;
  onCreateReceivable: () => void;
  onEdit: () => void;
  onLoadMoreReceivables: () => void;
  onOpenReceivable: (receivableId: string) => void;
  onRetry: () => void;
  state: CustomerDetailLoadState;
};

export function CustomerDetailScreen({
  canManage,
  copy,
  formatDate,
  formatMoney,
  onArchive,
  onBack,
  onCreateReceivable,
  onEdit,
  onLoadMoreReceivables,
  onOpenReceivable,
  onRetry,
  state,
}: CustomerDetailScreenProps) {
  if (state.kind === "loading") {
    return (
      <View className="flex-1 items-start justify-center gap-3 px-5 sm:px-8 lg:px-10">
        <ActivityIndicator color="#237A55" />
        <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.loading}</Text>
      </View>
    );
  }
  if (state.kind !== "ready") {
    const content =
      state.kind === "denied"
        ? { title: copy.deniedTitle, description: copy.deniedDescription }
        : state.kind === "offline"
          ? { title: copy.offlineTitle, description: copy.offlineDescription }
          : state.kind === "notFound"
            ? { title: copy.unavailableTitle, description: copy.unavailableDescription }
            : { title: copy.errorTitle, description: copy.errorDescription };
    return (
      <Page>
        <Button label={copy.back} onPress={onBack} variant="ghost" />
        <View className="gap-3 border-y border-line py-8 dark:border-[#304239]">
          <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
            {content.title}
          </Text>
          <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
            {content.description}
          </Text>
          {state.kind === "error" ? (
            <Button label={copy.retry} onPress={onRetry} variant="secondary" />
          ) : null}
        </View>
      </Page>
    );
  }

  const { balance, customer } = state.detail;
  return (
    <Page contentContainerClassName="gap-8">
      <Pressable
        accessibilityLabel={copy.back}
        accessibilityRole="button"
        className="min-h-11 flex-row items-center gap-2 self-start"
        onPress={onBack}
      >
        <ArrowLeft color="#237A55" size={18} />
        <Text className="font-bold text-positive dark:text-[#8DDEAF]">{copy.back}</Text>
      </Pressable>
      <ScreenHeader
        action={
          canManage && customer.status === "active" ? (
            <View className="flex-row flex-wrap gap-2">
              <Button label={copy.newReceivable} onPress={onCreateReceivable} variant="accent" />
              <Button onPress={onEdit} variant="secondary">
                <Pencil color="#14241D" size={17} />
                <ButtonText variant="secondary">{copy.update}</ButtonText>
              </Button>
              <Button onPress={onArchive} variant="ghost">
                <Archive color="#B94242" size={17} />
                <ButtonText className="text-danger" variant="ghost">
                  {copy.archive}
                </ButtonText>
              </Button>
            </View>
          ) : undefined
        }
        description={customer.status === "archived" ? copy.archivedDescription : copy.contact}
        title={customer.name}
      />
      {state.stale ? (
        <View className="border-l-4 border-warning bg-[#FFF6E8] p-3 dark:bg-[#3A2A18]">
          <Text className="text-sm text-ink dark:text-[#F2E4D2]">{copy.stale}</Text>
        </View>
      ) : null}
      <View className="gap-6 border-y border-line py-6 lg:flex-row dark:border-[#304239]">
        <View className="min-w-0 flex-1 gap-2">
          <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
            {copy.balance}
          </Text>
          <Text className="text-3xl font-black text-ink dark:text-white">
            {formatMoney(
              balance.outstandingMinorUnits,
              balance.currency,
              balance.currencyMinorUnitDigits,
            )}
          </Text>
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {copy.openReceivables}: {balance.openReceivableCount}
          </Text>
        </View>
        <View className="min-w-0 flex-1 gap-2 border-t border-line pt-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0 dark:border-[#304239]">
          <Text className="text-xs font-bold uppercase tracking-[1px] text-ink-muted dark:text-[#91A198]">
            {copy.overdue}
          </Text>
          <Text className="text-2xl font-black text-danger dark:text-[#FFBABA]">
            {formatMoney(
              balance.overdueMinorUnits,
              balance.currency,
              balance.currencyMinorUnitDigits,
            )}
          </Text>
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {balance.overdueReceivableCount}
          </Text>
        </View>
      </View>
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
          {copy.contact}
        </Text>
        <View className="gap-3 border-t border-line pt-4 dark:border-[#304239]">
          {customer.phone ? (
            <Text className="text-sm text-ink dark:text-white">
              {copy.phone}: {customer.phone}
            </Text>
          ) : null}
          {customer.email ? (
            <Text className="text-sm text-ink dark:text-white">
              {copy.email}: {customer.email}
            </Text>
          ) : null}
          {customer.notes ? (
            <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
              {copy.notes}: {customer.notes}
            </Text>
          ) : null}
          {!customer.phone && !customer.email && !customer.notes ? (
            <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">{copy.noContact}</Text>
          ) : null}
        </View>
      </View>
      <View className="gap-3">
        <Text accessibilityRole="header" className="text-xl font-black text-ink dark:text-white">
          {copy.receivableHistory}
        </Text>
        {state.receivables.length === 0 ? (
          <Text className="border-t border-line py-5 text-sm text-ink-muted dark:border-[#304239] dark:text-[#AAB8B0]">
            {copy.noReceivables}
          </Text>
        ) : (
          <View className="gap-4">
            <View className="border-t border-line dark:border-[#304239]">
              {state.receivables.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  className="min-h-16 flex-row items-center justify-between gap-4 border-b border-line py-4 active:opacity-70 dark:border-[#304239]"
                  key={item.id}
                  onPress={() => onOpenReceivable(item.id)}
                >
                  <View className="min-w-0 flex-1 gap-1">
                    <Text className="font-bold text-ink dark:text-white">{item.description}</Text>
                    <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                      {formatDate(item.postedDate)}
                    </Text>
                  </View>
                  <Text className="font-bold text-ink dark:text-white">
                    {formatMoney(
                      item.outstandingMinorUnits,
                      item.currency,
                      item.currencyMinorUnitDigits,
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>
            {state.receivablesNextCursor ? (
              <Button
                disabled={state.receivablesLoadingMore}
                label={copy.loadMore}
                loading={state.receivablesLoadingMore}
                onPress={onLoadMoreReceivables}
                variant="secondary"
              />
            ) : null}
          </View>
        )}
      </View>
    </Page>
  );
}
