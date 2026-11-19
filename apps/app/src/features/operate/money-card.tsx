import type { MoneyTrend, MoneyTrendRange } from "@pisto/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "expo-router";
import { TriangleAlert, Wallet } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { StatePanel } from "@/components/ui/state-panel";
import { Text } from "@/components/ui/text";
import { formatLocalDayMonth } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { formatMinorUnits } from "@/lib/money";
import { MoneyFigure } from "./money-figure";
import { type MoneyFigureRow, MoneyFigureRows, MoneyFigureStrip } from "./money-figure-rows";
import { MoneyTrendChart } from "./money-trend-chart";

export const MONEY_TREND_RANGES = ["7d", "30d", "6m"] as const satisfies readonly MoneyTrendRange[];

type Figure = MoneyFigureRow;

/**
 * "Dinero disponible". Phones get the lime hero card. Wide screens get one card in two columns:
 * the balance and its trend, and beside them the accounts that hold it.
 */
export function MoneyCard({
  canManageCash,
  compact,
  locale,
  onRangeChange,
  range,
  trend,
}: {
  canManageCash: boolean;
  compact: boolean;
  locale: string;
  onRangeChange: (range: MoneyTrendRange) => void;
  range: MoneyTrendRange;
  trend: UseQueryResult<MoneyTrend>;
}) {
  const { t } = useTranslation();
  const title = t("operate.home.money.title");
  const heading = (
    <View className="flex-row flex-wrap items-center justify-between gap-2">
      <Text
        accessibilityRole="header"
        aria-level={2}
        className={cn("font-heading text-title", compact && "text-highlight-foreground")}
      >
        {title}
      </Text>
      <FilterBar<MoneyTrendRange>
        label={t("operate.home.money.rangeLabel")}
        onChange={onRangeChange}
        options={MONEY_TREND_RANGES.map((value) => ({
          label: t(`operate.home.money.ranges.${value}`),
          value,
        }))}
        value={range}
      />
    </View>
  );
  const shell = (balance: ReactNode, accounts: ReactNode) =>
    compact ? (
      <View accessibilityLabel={title} className="gap-4 rounded-xl bg-highlight p-4" role="region">
        {heading}
        {balance}
        {accounts}
      </View>
    ) : (
      <View
        accessibilityLabel={title}
        className="flex-row overflow-hidden rounded-xl border border-border bg-card"
        role="region"
      >
        <View className="min-w-0 flex-1 gap-4 p-4">
          {heading}
          {balance}
        </View>
        <View className="w-[300px] shrink-0 border-l border-border p-4">{accounts}</View>
      </View>
    );

  if (trend.isPending) {
    return shell(
      <View aria-hidden className="gap-4">
        <Skeleton className="h-11 w-56" />
        <Skeleton className={compact ? "h-[110px]" : "h-[176px]"} />
      </View>,
      <View aria-hidden className="gap-3">
        {[0, 1, 2].map((index) => (
          <Skeleton className="h-9" key={index} />
        ))}
      </View>,
    );
  }
  if (trend.isError && !trend.data) {
    return (
      <StatePanel
        action={
          <Button
            label={t("common.retry")}
            onPress={() => void trend.refetch()}
            size="sm"
            variant="outline"
          />
        }
        description={t("operate.home.money.unavailable")}
        icon={TriangleAlert}
        level={2}
        title={t("operate.home.money.unavailableTitle")}
      />
    );
  }
  const data = trend.data;
  if (data.activeAccountCount === "0") {
    return (
      <EmptyState
        action={
          canManageCash ? (
            <Link asChild href="/operate/cash/accounts/new">
              <Button accessibilityRole="link" size="sm">
                <Text>{t("operate.home.money.createAccount")}</Text>
              </Button>
            </Link>
          ) : undefined
        }
        description={t("operate.home.money.noAccountsDescription")}
        icon={Wallet}
        title={t("operate.home.money.noAccountsTitle")}
      />
    );
  }

  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, data.currency, data.currencyMinorUnitDigits, locale);
  const change = data.changeMinorUnits;
  const since = formatLocalDayMonth(data.startLocalDate, locale);
  const figures: Figure[] = data.kinds.map((kind) => ({
    key: kind.kind,
    label: t(`operate.home.money.kinds.${kind.kind}`),
    value: money(kind.balanceMinorUnits),
  }));

  return shell(
    <>
      <View className="gap-1">
        <MoneyFigure
          className={cn("text-figure-xl", compact && "text-highlight-foreground")}
          currency={data.currency}
          fractionClassName={cn(
            "text-figure",
            compact ? "text-highlight-foreground/60" : "text-muted-foreground",
          )}
          fractionDigits={data.currencyMinorUnitDigits}
          locale={locale}
          minorUnits={data.closingMinorUnits}
        />
        <Text
          className={cn(
            "text-dense tabular-nums",
            compact ? "text-highlight-foreground/75" : "text-muted-foreground",
          )}
        >
          {change === "0" ? (
            t("operate.home.money.noChange", { date: since })
          ) : (
            <>
              <Text
                className={cn(
                  "font-ui text-dense tabular-nums",
                  compact
                    ? "text-highlight-foreground"
                    : change.startsWith("-")
                      ? "text-foreground"
                      : "text-positive-foreground",
                )}
              >
                {change.startsWith("-") ? money(change) : `+${money(change)}`}
              </Text>{" "}
              {t("operate.home.money.since", { date: since })}
            </>
          )}
        </Text>
      </View>
      <MoneyTrendChart
        height={compact ? 110 : 176}
        locale={locale}
        tone={compact ? "highlight" : "card"}
        trend={data}
      />
    </>,
    compact ? (
      <MoneyFigureStrip figures={figures} />
    ) : (
      <View className="flex-1 gap-3">
        <View className="min-h-8 flex-row items-center justify-between gap-2">
          <Text className="font-heading text-title">{t("operate.modules.cash.label")}</Text>
          <Link asChild href="/operate/cash">
            <Button
              accessibilityRole="link"
              className="-mr-1.5 h-7 px-1.5"
              size="sm"
              variant="ghost"
            >
              <Text className="text-xs text-muted-foreground">{t("operate.home.today.all")}</Text>
            </Button>
          </Link>
        </View>
        <MoneyFigureRows figures={figures} />
      </View>
    ),
  );
}
