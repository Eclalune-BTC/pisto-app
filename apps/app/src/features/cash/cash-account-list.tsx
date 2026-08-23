import { Pressable, Text, View } from "react-native";
import type { CashAccount } from "../../../../../packages/contracts/src/cash.ts";

type CashAccountListProps = {
  accounts: CashAccount[];
  activeLabel: string;
  archivedLabel: string;
  negativeAllowedLabel: string;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onOpenAccount: (accountId: string) => void;
};

export function CashAccountList({
  accounts,
  activeLabel,
  archivedLabel,
  negativeAllowedLabel,
  formatMoney,
  onOpenAccount,
}: CashAccountListProps) {
  return (
    <View className="border-y border-line dark:border-[#304239]">
      {accounts.map((account) => (
        <Pressable
          accessibilityLabel={`${account.name}, ${formatMoney(account.balanceMinorUnits, account.currency, account.currencyMinorUnitDigits)}`}
          accessibilityRole="button"
          className="min-h-16 gap-2 border-b border-line py-4 last:border-b-0 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between"
          key={account.id}
          onPress={() => onOpenAccount(account.id)}
        >
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-base font-bold text-ink dark:text-white">{account.name}</Text>
            <Text className="text-xs text-ink-muted dark:text-[#91A198]">
              {account.status === "active" ? activeLabel : archivedLabel}
              {account.allowNegativeBalance ? ` · ${negativeAllowedLabel}` : ""}
            </Text>
          </View>
          <Text className="text-lg font-black text-ink dark:text-white">
            {formatMoney(
              account.balanceMinorUnits,
              account.currency,
              account.currencyMinorUnitDigits,
            )}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
