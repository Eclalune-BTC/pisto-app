import type { CashAccount } from "@pisto/contracts";
import { type Href, Link } from "expo-router";
import { Banknote, Landmark, type LucideIcon, Smartphone, Wallet } from "lucide-react-native";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { StatusBadge } from "@/components/ui/status-badge";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { cashAccountKindLabels, cashAccountStatusLabels } from "./copy";

type CashAccountListProps = {
  accounts: CashAccount[];
  empty: ReactElement;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
};

const kindIcons: Record<CashAccount["kind"], LucideIcon> = {
  bank: Landmark,
  cash: Banknote,
  mobile_money: Smartphone,
  other: Wallet,
};

// `satisfies` keeps this exact route type; a wide `Href` return makes a ternary with another
// route exceed the TypeScript union limit (TS2590).
export function accountHref(accountId: string) {
  return { pathname: "/operate/cash/accounts/[accountId]", params: { accountId } } satisfies Href;
}

/**
 * The business's accounts as tiles, each with its balance: a business has a handful of them, and
 * the balance is what the owner came to read.
 */
export function CashAccountList({ accounts, empty, formatMoney }: CashAccountListProps) {
  const { t } = useTranslation();
  if (accounts.length === 0) return empty;
  const kinds = cashAccountKindLabels(t);
  const statuses = cashAccountStatusLabels(t);
  return (
    <View
      accessibilityLabel={t("filters.accounts")}
      className="flex-row flex-wrap gap-3"
      role="list"
    >
      {accounts.map((account) => (
        <View
          className="min-w-[240px] max-w-[360px] flex-1 basis-[240px]"
          key={account.id}
          role="listitem"
        >
          <Link asChild href={accountHref(account.id)}>
            <PressableSurface
              accessibilityRole="link"
              className="flex-1 gap-5 rounded-xl border border-border bg-card p-4"
            >
              <View className="flex-row items-center gap-3">
                <View className="size-9 items-center justify-center rounded-lg bg-muted">
                  <Icon
                    as={kindIcons[account.kind]}
                    className="text-foreground/80"
                    size={17}
                    strokeWidth={1.75}
                  />
                </View>
                <View className="min-w-0 flex-1">
                  <Text className="font-ui text-dense" numberOfLines={2}>
                    {account.name}
                  </Text>
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {kinds[account.kind]} · {account.currency}
                  </Text>
                </View>
              </View>
              <View className="gap-2">
                <Text
                  className={cn(
                    "font-heading text-figure tabular-nums",
                    account.balanceMinorUnits.startsWith("-") && "text-destructive",
                  )}
                  numberOfLines={1}
                >
                  {formatMoney(
                    account.balanceMinorUnits,
                    account.currency,
                    account.currencyMinorUnitDigits,
                  )}
                </Text>
                <View className="min-h-5 flex-row flex-wrap items-center gap-1.5">
                  <StatusBadge
                    label={statuses[account.status]}
                    tone={account.status === "active" ? "normal" : "exception"}
                  />
                  {account.allowNegativeBalance ? (
                    <Badge variant="outline">
                      <Text>{t("cash.negativeAllowed")}</Text>
                    </Badge>
                  ) : null}
                </View>
              </View>
            </PressableSurface>
          </Link>
        </View>
      ))}
    </View>
  );
}
