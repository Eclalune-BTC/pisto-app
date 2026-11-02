import type { MoneyTrend, MoneyTrendRange, ReceivablesSummary } from "@pisto/contracts";
import type { UseQueryResult } from "@tanstack/react-query";
import { Link } from "expo-router";
import { TriangleAlert, Wallet } from "lucide-react-native";
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
import { MoneyTrendChart } from "./money-trend-chart";

export const MONEY_TREND_RANGES = ["7d", "30d", "6m"] as const satisfies readonly MoneyTrendRange[];

type Figure = { key: string; label: string; value: string; detail?: string; attention?: boolean };

function Figures({ figures, tone }: { figures: Figure[]; tone: "card" | "highlight" }) {
  return (
    <View
      className={cn(
        "flex-row flex-wrap gap-y-3 border-t pt-3",
        tone === "card" ? "border-border" : "border-highlight-foreground/15",
      )}
    >
      {figures.map((figure, index) => (
        <View
          className={cn(
            "min-w-[120px] flex-1 gap-0.5 pr-3",
            index > 0 && "border-l pl-4",
            tone === "card" ? "border-border" : "border-highlight-foreground/15",
          )}
          key={figure.key}
        >
          <Text
            className={cn(
              "text-xs leading-4",
              tone === "card" ? "text-muted-foreground" : "text-highlight-foreground/70",
            )}
          >
            {figure.label}
          </Text>
          <Text
            className={cn(
              "font-heading text-[17px] leading-6 tabular-nums",
              tone === "highlight" && "text-highlight-foreground",
            )}
            numberOfLines={1}
          >
            {figure.value}
          </Text>
          {figure.detail ? (
            <Text
              className={cn(
                "text-xs leading-4",
                figure.attention
                  ? "text-warning-foreground"
                  : tone === "card"
                    ? "text-muted-foreground"
                    : "text-highlight-foreground/70",
              )}
              numberOfLines={1}
            >
              {figure.detail}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/**
 * "Dinero disponible": the lime hero card on phones, a white card with a lime chart on wide
 * screens, as in the Phase 2 prototypes.
 */
export function MoneyCard({
  canManageCash,
  compact,
  locale,
  onRangeChange,
  range,
  receivables,
  trend,
}: {
  canManageCash: boolean;
  compact: boolean;
  locale: string;
  onRangeChange: (range: MoneyTrendRange) => void;
  range: MoneyTrendRange;
  /** Present only when the member may read receivables. */
  receivables: UseQueryResult<ReceivablesSummary> | undefined;
  trend: UseQueryResult<MoneyTrend>;
}) {
  const { t } = useTranslation();
  const tone = compact ? "highlight" : "card";
  const rangeControl = (
    <FilterBar<MoneyTrendRange>
      label={t("operate.home.money.rangeLabel")}
      onChange={onRangeChange}
      options={MONEY_TREND_RANGES.map((value) => ({
        label: t(`operate.home.money.ranges.${value}`),
        value,
      }))}
      value={range}
    />
  );
  const shell = (children: React.ReactNode) => (
    <View
      accessibilityLabel={t("operate.home.money.title")}
      className={cn(
        "gap-4 rounded-xl p-4 sm:p-5",
        compact ? "bg-highlight" : "border border-border bg-card",
      )}
      role="region"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text
          accessibilityRole="header"
          aria-level={2}
          className={cn(
            "text-[13px]",
            compact ? "text-highlight-foreground/75" : "text-muted-foreground",
          )}
        >
          {t("operate.home.money.title")}
        </Text>
        {rangeControl}
      </View>
      {children}
    </View>
  );

  if (trend.isPending) {
    return shell(
      <View aria-hidden className="gap-4">
        <Skeleton className="h-11 w-56" />
        <Skeleton className={compact ? "h-[110px]" : "h-[180px]"} />
        <Skeleton className="h-10" />
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
  const summary = receivables?.data;
  if (summary && !compact) {
    const overdue = summary.overdueMinorUnits !== "0";
    figures.push({
      key: "receivables",
      label: t("operate.home.money.owed"),
      value: money(summary.outstandingMinorUnits),
      detail: overdue
        ? t("operate.home.money.overdue", { amount: money(summary.overdueMinorUnits) })
        : t("operate.home.money.nothingOverdue"),
      attention: overdue,
    });
  }

  return shell(
    <>
      <View className="gap-1">
        <MoneyFigure
          className={cn(
            "text-[40px] leading-[46px] tracking-[-1.4px] sm:text-[46px] sm:leading-[52px]",
            compact && "text-highlight-foreground",
          )}
          currency={data.currency}
          fractionClassName={cn(
            "text-[24px] tracking-[-0.6px]",
            compact ? "text-highlight-foreground/60" : "text-muted-foreground",
          )}
          fractionDigits={data.currencyMinorUnitDigits}
          locale={locale}
          minorUnits={data.closingMinorUnits}
        />
        <Text
          className={cn(
            "text-[13px] tabular-nums",
            compact ? "text-highlight-foreground/75" : "text-muted-foreground",
          )}
        >
          {change === "0" ? (
            t("operate.home.money.noChange", { date: since })
          ) : (
            <>
              <Text
                className={cn(
                  "font-ui text-[13px] tabular-nums",
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
      <MoneyTrendChart height={compact ? 110 : 180} locale={locale} tone={tone} trend={data} />
      <Figures figures={figures} tone={tone} />
    </>,
  );
}
