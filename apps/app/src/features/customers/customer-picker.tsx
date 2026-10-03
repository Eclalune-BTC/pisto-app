import type { Customer } from "@pisto/contracts";
import { Search } from "lucide-react-native";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";

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
        <Text accessibilityRole="header" className="text-2xl font-heading text-foreground">
          {copy.receivables.picker.activeCustomersTitle}
        </Text>
        <Text className="font-sans text-sm leading-5 text-muted-foreground">
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
        <LoadingIndicator />
      ) : isOffline ? (
        <View className="gap-3 border-y border-border py-5">
          <Text className="font-sans text-sm text-muted-foreground">
            {copy.access.offlineDescription}
          </Text>
        </View>
      ) : isError ? (
        <View className="gap-3 border-y border-border py-5">
          <Text className="font-sans text-sm text-muted-foreground">
            {copy.common.unavailableDescription}
          </Text>
          <Button label={copy.common.retry} onPress={onRetry} variant="outline" />
        </View>
      ) : items.length === 0 ? (
        <Text className="font-sans border-y border-border py-5 text-sm text-muted-foreground">
          {copy.receivables.picker.noCustomers}
        </Text>
      ) : (
        <SelectField
          label={copy.receivables.form.customer}
          onChange={(id) => {
            const selected = items.find((item) => item.id === id);
            if (!selected) throw new Error("The selected customer is not in the loaded result.");
            onSelect(selected);
          }}
          options={items.map((customer) => ({
            value: customer.id,
            label: [customer.name, customer.email, customer.phone].filter(Boolean).join(" · "),
          }))}
          value={selectedCustomerId}
        />
      )}
      {hasNextPage ? (
        <Button
          label={copy.customers.list.loadMore}
          loading={isLoadingMore}
          onPress={onLoadMore}
          variant="outline"
        />
      ) : null}
      <Button label={copy.common.back} onPress={onBack} variant="ghost" />
    </View>
  );
}
