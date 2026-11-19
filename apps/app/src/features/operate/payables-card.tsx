import type { PayablesSummaryResponse } from "@pisto/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "expo-router";
import { CalendarClock, TriangleAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { formatLocalDayMonth } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { formatMinorUnits } from "@/lib/money";
import { MoneyFigure } from "./money-figure";

/** "Por pagar": what the business owes its suppliers and the next payment that falls due. */
export function PayablesCard({
  className,
  locale,
  summary,
}: {
  /** How the card sits in its row. */
  className?: string;
  locale: string;
  summary: UseQueryResult<PayablesSummaryResponse["data"]>;
}) {
  const { t } = useTranslation();
  const header = (
    <View className="flex-row items-center justify-between gap-2">
      <Text accessibilityRole="header" aria-level={2} className="font-heading text-title">
        {t("operate.home.payables.title")}
      </Text>
      <Link asChild href="/operate/payables">
        <Button accessibilityRole="link" className="-mr-1.5 h-7 px-1.5" size="sm" variant="ghost">
          <Text className="text-xs text-muted-foreground">{t("operate.home.payables.all")}</Text>
        </Button>
      </Link>
    </View>
  );

  if (summary.isError && !summary.data) {
    return (
      <View className={cn("gap-3 rounded-xl border border-border bg-card p-4", className)}>
        {header}
        <View className="items-start gap-2">
          <View className="flex-row items-center gap-2">
            <Icon as={TriangleAlert} className="text-muted-foreground" size={16} />
            <Text className="text-dense">{t("operate.home.payables.unavailableTitle")}</Text>
          </View>
          <Button
            label={t("common.retry")}
            onPress={() => void summary.refetch()}
            size="sm"
            variant="outline"
          />
        </View>
      </View>
    );
  }
  if (!summary.data) {
    return (
      <View
        aria-hidden
        className={cn("gap-3 rounded-xl border border-border bg-card p-4", className)}
      >
        {header}
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10" />
      </View>
    );
  }

  const totals = summary.data;
  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, totals.currency, totals.currencyMinorUnitDigits, locale);
  const overdue = totals.overdueMinorUnits !== "0";
  const next = totals.nextDue;

  return (
    <View
      accessibilityLabel={t("operate.home.payables.title")}
      className={cn("gap-3 rounded-xl border border-border bg-card p-4", className)}
      role="region"
    >
      {header}
      {totals.outstandingMinorUnits === "0" ? (
        <View className="items-start gap-1 py-2">
          <Icon as={CalendarClock} className="text-muted-foreground" size={16} />
          <Text className="font-ui text-dense">{t("operate.home.payables.emptyTitle")}</Text>
          <Text className="text-xs leading-4 text-muted-foreground">
            {t("operate.home.payables.emptyDescription")}
          </Text>
        </View>
      ) : (
        <>
          <View className="gap-0.5">
            <MoneyFigure
              className="text-figure-lg"
              currency={totals.currency}
              fractionClassName="text-lg text-muted-foreground"
              fractionDigits={totals.currencyMinorUnitDigits}
              locale={locale}
              minorUnits={totals.outstandingMinorUnits}
            />
            <Text
              className={cn(
                "text-xs leading-4",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {overdue
                ? t("operate.home.money.overdue", { amount: money(totals.overdueMinorUnits) })
                : t("operate.home.debtors.nothingOverdue")}
              {" · "}
              <Text className="text-xs leading-4 text-muted-foreground">
                {t("operate.home.payables.purchases", { count: Number(totals.openPurchaseCount) })}
              </Text>
            </Text>
          </View>
          {next ? (
            // The hairline is on a square wrapper: on the rounded row it curled at both ends.
            <View className="border-t border-border">
              <Link
                asChild
                href={{
                  pathname: "/operate/purchases/[purchaseId]",
                  params: { purchaseId: next.purchaseId },
                }}
              >
                <PressableSurface
                  accessibilityLabel={t("operate.home.payables.nextLabel", {
                    amount: money(next.balanceMinorUnits),
                    date: formatLocalDayMonth(next.dueDate, locale),
                    supplier: next.supplierName,
                  })}
                  accessibilityRole="link"
                  className="-mx-1 rounded-md px-1"
                >
                  <View className="min-h-12 flex-row items-center gap-3 py-2">
                    <View className="min-w-0 flex-1">
                      <Text className="text-xs leading-4 text-muted-foreground">
                        {t("operate.home.payables.next")}
                      </Text>
                      <Text className="font-ui text-dense" numberOfLines={1}>
                        {next.supplierName}
                      </Text>
                      <Text
                        className={cn(
                          "text-xs leading-4",
                          next.dueDate < totals.businessLocalDate
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {t("operate.home.debtors.dueOn", {
                          date: formatLocalDayMonth(next.dueDate, locale),
                        })}
                      </Text>
                    </View>
                    <Text className="font-ui text-dense tabular-nums">
                      {money(next.balanceMinorUnits)}
                    </Text>
                  </View>
                </PressableSurface>
              </Link>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}
