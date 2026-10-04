import type { CashAccount } from "@pisto/contracts";
import { useTranslation } from "react-i18next";
import { Text } from "@/components/ui/text";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { formatMinorUnits } from "@/lib/money";

/** The server balance of the chosen account, so an amount can be weighed against it. */
export function AccountBalanceHint({ account }: { account: CashAccount | undefined }) {
  const { i18n, t } = useTranslation();
  if (!account) return null;
  return (
    <Text className="text-[13px] leading-5 text-muted-foreground">
      {t("cash.fields.currentBalance")}{" "}
      <Text
        className={cn(
          "font-ui text-[13px] tabular-nums text-foreground",
          account.balanceMinorUnits.startsWith("-") && "text-destructive",
        )}
      >
        {formatMinorUnits(
          account.balanceMinorUnits,
          account.currency,
          account.currencyMinorUnitDigits,
          requireSupportedLocale(i18n.resolvedLanguage),
        )}
      </Text>
    </Text>
  );
}
