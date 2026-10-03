import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { SelectField } from "@/components/ui/select-field";
import { Text } from "@/components/ui/text";
import { buildCustomersCopy } from "@/features/customers/copy";

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
  const { t } = useTranslation();
  const copy = useMemo(() => buildCustomersCopy(t), [t]);
  return (
    <View className="gap-6">
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-2xl font-heading text-foreground">
          {copy.receivables.picker.activeAccountsTitle}
        </Text>
        <Text className="font-sans text-sm leading-5 text-muted-foreground">
          {copy.receivables.picker.activeAccountsDescription}
        </Text>
      </View>
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
          {copy.receivables.picker.noAccounts}
        </Text>
      ) : (
        <SelectField
          label={copy.receivables.picker.activeAccountsTitle}
          onChange={(id) => {
            const selected = items.find((item) => item.id === id);
            if (!selected) throw new Error("The selected account is not in the loaded result.");
            onSelect(selected);
          }}
          options={items.map((account) => ({
            value: account.id,
            label: account.name,
          }))}
          value={selectedAccountId}
        />
      )}
      {hasNextPage ? (
        <Button
          label={copy.receivables.picker.loadMoreAccounts}
          loading={isLoadingMore}
          onPress={onLoadMore}
          variant="outline"
        />
      ) : null}
      <Button label={copy.common.back} onPress={onBack} variant="ghost" />
    </View>
  );
}
