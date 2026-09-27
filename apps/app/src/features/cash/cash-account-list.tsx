import type { CashAccount } from "@pisto/contracts";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";

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
    <View className="border-y border-border">
      {accounts.map((account) => (
        <Button
          accessibilityLabel={`${account.name}, ${formatMoney(account.balanceMinorUnits, account.currency, account.currencyMinorUnitDigits)}`}
          className="min-h-16 flex-col items-stretch justify-start gap-2 rounded-none border-b border-line px-0 py-4 last:border-b-0 dark:border-[#304239] sm:flex-row sm:items-center sm:justify-between"
          key={account.id}
          onPress={() => onOpenAccount(account.id)}
          variant="ghost"
        >
          <View className="min-w-0 flex-1 gap-1">
            <Text className="text-base font-bold text-foreground">{account.name}</Text>
            <Text className="text-xs text-ink-muted dark:text-[#91A198]">
              {account.status === "active" ? activeLabel : archivedLabel}
              {account.allowNegativeBalance ? ` · ${negativeAllowedLabel}` : ""}
            </Text>
          </View>
          <Text className="text-lg font-black text-foreground">
            {formatMoney(
              account.balanceMinorUnits,
              account.currency,
              account.currencyMinorUnitDigits,
            )}
          </Text>
        </Button>
      ))}
    </View>
  );
}
