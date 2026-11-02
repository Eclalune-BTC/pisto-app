import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { CashFlowChart } from "@/features/reports/cash-flow-chart";
import { capitalizeFirst } from "@/features/reports/report-figures";
import { formatLocalDateFull, formatMonthName } from "@/i18n/format";
import { cn } from "@/lib/cn";
import {
  type AgingBucket,
  EXAMPLE_AGING,
  EXAMPLE_CREDITORS,
  EXAMPLE_DEBTORS,
  EXAMPLE_MOVEMENTS,
  EXAMPLE_PAYABLES,
  EXAMPLE_RECEIVABLES,
  exampleCashFlow,
  movementTotals,
} from "./example-business";
import { BalanceList, MovementLine, Surface, SurfaceHeader, useExample } from "./fragments";

export const MODULES = ["movements", "receivables", "payables", "reports"] as const;

const AGING_BUCKETS = ["current", "days1To30", "days31To60", "over60"] as const;

/** The same chart marks as the receivables screen: later is a stronger warning. */
const bucketColors: Record<AgingBucket, string> = {
  current: "bg-chart-2",
  days1To30: "bg-chart-4",
  days31To60: "bg-chart-5",
  over60: "bg-destructive",
};

function Figure({
  detail,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  label: string;
  tone?: "default" | "destructive";
  value: string;
}) {
  return (
    <View className="min-w-0 flex-1 gap-0.5 px-4 py-3">
      <Text className="text-xs leading-4 text-muted-foreground">{label}</Text>
      <Text
        className={cn(
          "font-heading text-xl leading-7 tracking-[-0.4px] tabular-nums",
          tone === "destructive" && "text-destructive",
        )}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
        {detail}
      </Text>
    </View>
  );
}

function MovementsPreview() {
  const { t } = useTranslation();
  const { locale, money, signedMoney, today } = useExample();
  const totals = movementTotals(EXAMPLE_MOVEMENTS);
  return (
    <Surface>
      <View className="min-h-9 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-muted/60 px-4 py-2">
        <Text className="font-ui text-xs text-foreground">
          {t("movements.today", { date: formatLocalDateFull(today, locale, { year: false }) })}
        </Text>
        <Text className="text-xs text-muted-foreground tabular-nums">
          {t("movements.totals.day", {
            inflow: signedMoney(totals.inflow),
            outflow: money(`-${totals.outflow}`),
          })}
        </Text>
      </View>
      {EXAMPLE_MOVEMENTS.map((movement, index) => (
        <MovementLine
          className={cn(index > 0 && "border-t border-border")}
          key={movement.key}
          movement={movement}
          showKind
        />
      ))}
    </Surface>
  );
}

function ReceivablesPreview() {
  const { t } = useTranslation();
  const { money } = useExample();
  const overdueAccounts = AGING_BUCKETS.filter((bucket) => bucket !== "current").reduce(
    (sum, bucket) => sum + EXAMPLE_AGING[bucket].accounts,
    0,
  );
  const total = Number(EXAMPLE_RECEIVABLES.outstanding);
  return (
    <Surface>
      <View className="flex-row border-b border-border">
        <Figure
          detail={t("operate.home.debtors.customers", { count: EXAMPLE_RECEIVABLES.customers })}
          label={t("receivables.summary.outstanding")}
          value={money(EXAMPLE_RECEIVABLES.outstanding)}
        />
        <View className="w-px bg-border" />
        <Figure
          detail={t("receivables.aging.count", { count: overdueAccounts })}
          label={t("receivables.summary.overdue")}
          tone="destructive"
          value={money(EXAMPLE_RECEIVABLES.overdue)}
        />
      </View>
      <View className="gap-3 px-4 pt-3.5">
        <Text className="font-heading text-[13px] leading-5">{t("receivables.aging.title")}</Text>
        <View aria-hidden className="h-2 flex-row gap-0.5 overflow-hidden rounded-xs bg-muted">
          {AGING_BUCKETS.map((bucket) => (
            <View
              className={cn("h-full", bucketColors[bucket])}
              key={bucket}
              style={{ width: `${(Number(EXAMPLE_AGING[bucket].minorUnits) / total) * 100}%` }}
            />
          ))}
        </View>
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          {AGING_BUCKETS.map((bucket) => (
            <View className="min-w-[96px] flex-1 gap-0.5" key={bucket}>
              <View className="flex-row items-center gap-1.5">
                <View aria-hidden className={cn("size-2 rounded-xs", bucketColors[bucket])} />
                <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
                  {t(`receivables.aging.buckets.${bucket}`)}
                </Text>
              </View>
              <Text className="font-ui text-[13px] leading-5 tabular-nums">
                {money(EXAMPLE_AGING[bucket].minorUnits)}
              </Text>
            </View>
          ))}
        </View>
        <BalanceList balances={EXAMPLE_DEBTORS.slice(0, 2)} />
      </View>
    </Surface>
  );
}

function PayablesPreview() {
  const { t } = useTranslation();
  const { money } = useExample();
  return (
    <Surface className="gap-3 p-4">
      <SurfaceHeader title={t("operate.home.payables.title")} />
      <View className="gap-0.5">
        <Text className="font-heading text-2xl leading-8 tracking-[-0.5px] tabular-nums">
          {money(EXAMPLE_PAYABLES.outstanding)}
        </Text>
        <Text className="text-xs leading-4 text-muted-foreground">
          {t("operate.home.debtors.nothingOverdue")}
          {" · "}
          {t("operate.home.payables.purchases", { count: EXAMPLE_PAYABLES.purchases })}
        </Text>
      </View>
      <BalanceList balances={EXAMPLE_CREDITORS} initials={false} />
    </Surface>
  );
}

function ReportsPreview() {
  const { t } = useTranslation();
  const { locale, money, signedMoney, today } = useExample();
  const months = exampleCashFlow(today);
  const recent = months.slice(-3);
  const monthLabel = (month: string, index: number) => {
    const name = capitalizeFirst(formatMonthName(`${month}-01`, locale, "long"), locale);
    return index === recent.length - 1
      ? t("reports.cashFlow.monthToDate", { month: name, day: Number(today.slice(8)) })
      : name;
  };
  return (
    <Surface>
      <View className="gap-3 px-4 pt-3.5">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Text className="font-heading text-[15px] leading-5">{t("reports.cashFlow.title")}</Text>
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1.5">
              <View className="size-2 rounded-xs bg-primary" />
              <Text className="text-xs text-muted-foreground">{t("reports.cashFlow.inflow")}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="size-2 rounded-xs bg-muted-foreground/35" />
              <Text className="text-xs text-muted-foreground">{t("reports.cashFlow.outflow")}</Text>
            </View>
          </View>
        </View>
        <CashFlowChart locale={locale} months={months} />
      </View>
      <View className="mt-3 border-t border-border">
        <View className="flex-row gap-3 bg-muted/60 px-4 py-2">
          <Text className="flex-1 text-xs text-muted-foreground">
            {t("reports.cashFlow.columns.month")}
          </Text>
          {(["inflow", "outflow", "net"] as const).map((column) => (
            <Text
              className={cn(
                "w-24 text-right text-xs text-muted-foreground",
                column === "outflow" && "hidden sm:flex",
              )}
              key={column}
            >
              {t(`reports.cashFlow.columns.${column}`)}
            </Text>
          ))}
        </View>
        {recent.map((month, index) => (
          <View className="flex-row gap-3 border-t border-border px-4 py-2" key={month.month}>
            <Text className="min-w-0 flex-1 text-[13px]" numberOfLines={1}>
              {monthLabel(month.month, index)}
            </Text>
            <Text className="w-24 text-right text-[13px] tabular-nums">
              {money(month.inflowMinorUnits)}
            </Text>
            <Text className="hidden w-24 text-right text-[13px] tabular-nums text-muted-foreground sm:flex">
              {money(`-${month.outflowMinorUnits}`)}
            </Text>
            <Text className="w-24 text-right font-ui text-[13px] tabular-nums">
              {signedMoney(month.netMinorUnits)}
            </Text>
          </View>
        ))}
      </View>
    </Surface>
  );
}

const previews: Record<(typeof MODULES)[number], () => ReactNode> = {
  movements: () => <MovementsPreview />,
  receivables: () => <ReceivablesPreview />,
  payables: () => <PayablesPreview />,
  reports: () => <ReportsPreview />,
};

/** The modules a business works in every day, each shown by a fragment of its real screen. */
export function ModulePreviews() {
  const { t } = useTranslation();
  return (
    <View className="min-w-0 gap-y-14 md:-mx-4 md:flex-row md:flex-wrap md:gap-y-16" role="list">
      {MODULES.map((module) => (
        <View className="min-w-0 gap-5 md:w-1/2 md:px-4" key={module} role="listitem">
          <View className="gap-1.5">
            <Heading className="text-base leading-6" level={3}>
              {t(`welcome.modules.items.${module}.title`)}
            </Heading>
            <Text className="text-[15px] leading-6 text-muted-foreground">
              {t(`welcome.modules.items.${module}.description`)}
            </Text>
          </View>
          <View
            accessibilityLabel={t(`welcome.modules.items.${module}.figure`)}
            className="pointer-events-none min-w-0"
            role="figure"
          >
            {previews[module]()}
          </View>
        </View>
      ))}
    </View>
  );
}
