import type { Debtors, ReceivablesSummary } from "@pisto/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "expo-router";
import { HandCoins, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatLocalDayMonth } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/initials";
import { formatMinorUnits } from "@/lib/money";
import { MoneyFigure } from "./money-figure";

/** "Por cobrar": the open balance and the customers who owe the most, overdue first. */
export function DebtorsCard({
  canOpenCustomers,
  debtors,
  locale,
  summary,
}: {
  canOpenCustomers: boolean;
  debtors: UseQueryResult<Debtors>;
  locale: string;
  summary: UseQueryResult<ReceivablesSummary>;
}) {
  const { t } = useTranslation();
  const header = (
    <View className="flex-row items-center justify-between gap-2">
      <Text accessibilityRole="header" aria-level={2} className="font-heading text-[15px]">
        {t("operate.home.debtors.title")}
      </Text>
      <Link asChild href="/operate/receivables">
        <Button accessibilityRole="link" className="h-7 px-1.5" size="sm" variant="ghost">
          <Text className="text-xs text-muted-foreground">{t("operate.home.debtors.all")}</Text>
        </Button>
      </Link>
    </View>
  );

  const failed = (debtors.isError && !debtors.data) || (summary.isError && !summary.data);
  if (failed) {
    return (
      <View className="gap-3 rounded-xl border border-border bg-card p-4">
        {header}
        <View className="items-start gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={TriangleAlert} className="text-muted-foreground" size={16} />
            <Text className="text-[13px]">{t("operate.home.debtors.unavailableTitle")}</Text>
          </View>
          <Button
            label={t("common.retry")}
            onPress={() => {
              void debtors.refetch();
              void summary.refetch();
            }}
            size="sm"
            variant="outline"
          />
        </View>
      </View>
    );
  }
  if (!debtors.data || !summary.data) {
    return (
      <View aria-hidden className="gap-3 rounded-xl border border-border bg-card p-4">
        {header}
        <Skeleton className="h-8 w-40" />
        {[0, 1, 2].map((index) => (
          <Skeleton className="h-10" key={index} />
        ))}
      </View>
    );
  }

  const list = debtors.data;
  const totals = summary.data;
  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, list.currency, list.currencyMinorUnitDigits, locale);
  const overdue = totals.overdueMinorUnits !== "0";

  return (
    <View
      accessibilityLabel={t("operate.home.debtors.title")}
      className="gap-3 rounded-xl border border-border bg-card p-4"
      role="region"
    >
      {header}
      {list.items.length === 0 ? (
        <View className="items-start gap-1 py-2">
          <Icon as={HandCoins} className="text-muted-foreground" size={16} />
          <Text className="font-ui text-[13px]">{t("operate.home.debtors.emptyTitle")}</Text>
          <Text className="text-xs leading-4 text-muted-foreground">
            {t("operate.home.debtors.emptyDescription")}
          </Text>
        </View>
      ) : (
        <>
          <View className="gap-0.5">
            <MoneyFigure
              className="text-[28px] leading-9 tracking-[-0.8px]"
              currency={totals.currency}
              fractionClassName="text-[17px] text-muted-foreground"
              fractionDigits={totals.currencyMinorUnitDigits}
              locale={locale}
              minorUnits={totals.outstandingMinorUnits}
            />
            <Text
              className={cn(
                "text-xs leading-4",
                overdue ? "text-warning-foreground" : "text-muted-foreground",
              )}
            >
              {overdue
                ? t("operate.home.money.overdue", { amount: money(totals.overdueMinorUnits) })
                : t("operate.home.debtors.nothingOverdue")}
              {" · "}
              <Text className="text-xs leading-4 text-muted-foreground">
                {t("operate.home.debtors.customers", { count: Number(list.customerCount) })}
              </Text>
            </Text>
          </View>
          <View className="border-t border-border">
            {list.items.map((debtor) => {
              const due = debtor.overdueSinceLocalDate
                ? t("operate.home.debtors.overdueSince", {
                    date: formatLocalDayMonth(debtor.overdueSinceLocalDate, locale),
                  })
                : debtor.nextDueLocalDate
                  ? t("operate.home.debtors.dueOn", {
                      date: formatLocalDayMonth(debtor.nextDueLocalDate, locale),
                    })
                  : t("operate.home.debtors.noDueDate");
              const row = (
                <View
                  className="min-h-12 flex-row items-center gap-3 border-b border-border py-2"
                  key={debtor.customerId}
                >
                  <View className="size-8 items-center justify-center rounded-full bg-muted">
                    <Text className="font-ui text-[11px] text-muted-foreground">
                      {initialsOf(debtor.customerName)}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="font-ui text-[13px] leading-5" numberOfLines={1}>
                      {debtor.customerName}
                    </Text>
                    <Text
                      className={cn(
                        "text-xs leading-4",
                        debtor.overdueSinceLocalDate
                          ? "text-warning-foreground"
                          : "text-muted-foreground",
                      )}
                      numberOfLines={1}
                    >
                      {due}
                    </Text>
                  </View>
                  <Text className="font-ui text-[13px] tabular-nums">
                    {money(debtor.outstandingMinorUnits)}
                  </Text>
                </View>
              );
              return canOpenCustomers ? (
                <Link
                  asChild
                  href={{
                    pathname: "/operate/customers/[customerId]",
                    params: { customerId: debtor.customerId },
                  }}
                  key={debtor.customerId}
                >
                  <PressableSurface
                    accessibilityLabel={`${debtor.customerName}, ${due}, ${money(debtor.outstandingMinorUnits)}`}
                    accessibilityRole="link"
                    className="-mx-1 rounded-md px-1"
                  >
                    {row}
                  </PressableSurface>
                </Link>
              ) : (
                <View key={debtor.customerId}>{row}</View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}
