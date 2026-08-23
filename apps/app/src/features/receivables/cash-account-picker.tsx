import { Check, RefreshCw } from "lucide-react-native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button, ButtonText } from "@/components/ui/button";
import { customersReceivablesCopy as copy } from "@/features/customers/copy";

import type { CashAccountChoice } from "./cash-account-source";

type CashAccountPickerProps = {
  hasNextPage: boolean;
  isError: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOffline: boolean;
  items: CashAccountChoice[];
  onBack: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onSelect: (account: CashAccountChoice) => void;
  selectedAccountId: string | null;
};

export function CashAccountPicker({
  hasNextPage,
  isError,
  isLoading,
  isLoadingMore,
  isOffline,
  items,
  onBack,
  onLoadMore,
  onRetry,
  onSelect,
  selectedAccountId,
}: CashAccountPickerProps) {
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-2xl font-black text-ink dark:text-white">
          {copy.receivables.picker.activeAccountsTitle}
        </Text>
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {copy.receivables.picker.activeAccountsDescription}
        </Text>
      </View>
      {isLoading ? (
        <ActivityIndicator color="#237A55" />
      ) : isOffline ? (
        <View className="gap-3 border-y border-line py-5 dark:border-[#304239]">
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {copy.access.offlineDescription}
          </Text>
        </View>
      ) : isError ? (
        <View className="gap-3 border-y border-line py-5 dark:border-[#304239]">
          <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
            {copy.common.unavailableDescription}
          </Text>
          <Button label={copy.common.retry} onPress={onRetry} variant="secondary" />
        </View>
      ) : items.length === 0 ? (
        <Text className="border-y border-line py-5 text-sm text-ink-muted dark:border-[#304239] dark:text-[#AAB8B0]">
          {copy.receivables.picker.noAccounts}
        </Text>
      ) : (
        <View accessibilityRole="radiogroup" className="border-t border-line dark:border-[#304239]">
          {items.map((account) => {
            const selected = account.id === selectedAccountId;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                className="min-h-14 flex-row items-center justify-between gap-4 border-b border-line py-3 active:opacity-70 dark:border-[#304239]"
                key={account.id}
                onPress={() => onSelect(account)}
              >
                <Text className="min-w-0 flex-1 font-bold text-ink dark:text-white">
                  {account.name}
                </Text>
                {selected ? <Check color="#237A55" size={19} strokeWidth={3} /> : null}
              </Pressable>
            );
          })}
        </View>
      )}
      {hasNextPage ? (
        <Button disabled={isLoadingMore} onPress={onLoadMore} variant="secondary">
          {isLoadingMore ? (
            <ActivityIndicator color="#14241D" />
          ) : (
            <>
              <RefreshCw color="#14241D" size={17} />
              <ButtonText variant="secondary">{copy.customers.list.loadMore}</ButtonText>
            </>
          )}
        </Button>
      ) : null}
      <Button label={copy.common.back} onPress={onBack} variant="ghost" />
    </View>
  );
}
