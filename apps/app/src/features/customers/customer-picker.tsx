import type { Customer } from "@pisto/contracts";
import { Check, RefreshCw, Search } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Button, ButtonText } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import { buildCustomersCopy } from "./copy";

type CustomerPickerProps = {
  hasNextPage: boolean;
  isError: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isOffline: boolean;
  items: Customer[];
  onBack: () => void;
  onLoadMore: () => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (customer: Customer) => void;
  search: string;
  selectedCustomerId: string | null;
};

export function CustomerPicker({
  hasNextPage,
  isError,
  isLoading,
  isLoadingMore,
  isOffline,
  items,
  onBack,
  onLoadMore,
  onRetry,
  onSearchChange,
  onSelect,
  search,
  selectedCustomerId,
}: CustomerPickerProps) {
  const { t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-2xl font-black text-ink dark:text-white">
          {copy.receivables.picker.activeCustomersTitle}
        </Text>
        <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">
          {copy.receivables.picker.activeCustomersDescription}
        </Text>
      </View>
      <Field
        label={copy.customers.list.searchLabel}
        onChangeText={onSearchChange}
        placeholder={copy.customers.list.searchPlaceholder}
        trailing={<Search color="#617168" size={18} />}
        value={search}
      />
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
          {copy.receivables.picker.noCustomers}
        </Text>
      ) : (
        <View className="border-t border-line dark:border-[#304239]">
          {items.map((customer) => {
            const selected = customer.id === selectedCustomerId;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                className="min-h-14 flex-row items-center justify-between gap-4 border-b border-line py-3 active:opacity-70 dark:border-[#304239]"
                key={customer.id}
                onPress={() => onSelect(customer)}
              >
                <View className="min-w-0 flex-1 gap-1">
                  <Text className="font-bold text-ink dark:text-white">{customer.name}</Text>
                  {customer.email || customer.phone ? (
                    <Text className="text-sm text-ink-muted dark:text-[#AAB8B0]">
                      {customer.email ?? customer.phone}
                    </Text>
                  ) : null}
                </View>
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
