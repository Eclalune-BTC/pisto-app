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
  EXAMPLE_PAYABLES,
  EXAMPLE_RECEIVABLES,
  EXAMPLE_YESTERDAY,
  exampleCashFlow,
  movementTotals,
  shiftLocalDate,
} from "./example-business";
import { MovementLine, Surface, useExample } from "./fragments";

export const MODULES = ["movements", "receivables", "payables", "reports"] as const;

const AGING_BUCKETS = ["current", "days1To30", "days31To60", "over60"] as const;

/** The same chart marks as the receivables screen: later is a stronger warning. */
const bucketColors: Record<AgingBucket, string> = {
  current: "bg-chart-2",
  days1To30: "bg-chart-4",
  days31To60: "bg-chart-5",
  over60: "bg-destructive",
};

/** A labelled figure of a summary strip, like the screens' own. */
function Figure({
  detail,
  label,
  tone = "default",
  value,
}: {
  detail?: string;
  label: string;
  /** The screen's own tone: red for overdue, amber for due soon. */
  tone?: "default" | "destructive" | "warning";
  value: string;
}) {
  return (
    <View className="min-w-0 flex-1 gap-0.5 px-4 py-3">
      <Text className="text-xs leading-4 text-muted-foreground">{label}</Text>
      <Text
        className={cn(
          "font-heading text-xl leading-7 tracking-[-0.4px] tabular-nums",
          tone === "destructive" && "text-destructive",
          tone === "warning" && "text-warning-foreground",
        )}
        numberOfLines={1}
      >
        {value}
      </Text>
      {detail ? (
        <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

function FigureStrip({ children }: { children: ReactNode }) {
  return <View className="flex-row border-b border-border">{children}</View>;
}

function Divider() {
  return <View className="w-px bg-border" />;
}

/** Column headings on the muted strip the app's tables use. */
function TableHead({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-3 bg-muted/60 px-4 py-2">{children}</View>;
}

function MovementsPreview() {
  const { t } = useTranslation();
  const { locale, money, signedMoney, today } = useExample();
  const totals = movementTotals(EXAMPLE_YESTERDAY);
  const day = formatLocalDateFull(shiftLocalDate(today, -1), locale, { year: false });
  return (
    <Surface>
      <View className="min-h-9 flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border bg-muted/60 px-4 py-2">
        <Text className="font-ui text-xs text-foreground">{capitalizeFirst(day, locale)}</Text>
        <Text className="text-xs text-muted-foreground tabular-nums">
          {t("movements.totals.day", {
            inflow: signedMoney(totals.inflow),
            outflow: money(`-${totals.outflow}`),
          })}
        </Text>
      </View>
      {EXAMPLE_YESTERDAY.map((movement, index) => (
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
      <FigureStrip>
        <Figure
          detail={t("operate.home.debtors.customers", { count: EXAMPLE_RECEIVABLES.customers })}
          label={t("receivables.summary.outstanding")}
          value={money(EXAMPLE_RECEIVABLES.outstanding)}
        />
        <Divider />
        <Figure
          detail={t("receivables.aging.count", { count: overdueAccounts })}
          label={t("receivables.summary.overdue")}
          tone="destructive"
          value={money(EXAMPLE_RECEIVABLES.overdue)}
        />
      </FigureStrip>
      <View className="gap-3 px-4 py-3.5">
        <View className="flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <Text className="font-heading text-[13px] leading-5">{t("receivables.aging.title")}</Text>
          <Text className="text-xs leading-4 text-muted-foreground">
            {t("receivables.aging.scope")}
          </Text>
        </View>
        <View aria-hidden className="h-2 flex-row gap-0.5 overflow-hidden rounded-xs bg-muted">
          {AGING_BUCKETS.map((bucket) => (
            <View
              className={cn("h-full", bucketColors[bucket])}
              key={bucket}
              style={{ width: `${(Number(EXAMPLE_AGING[bucket].minorUnits) / total) * 100}%` }}
            />
          ))}
        </View>
        <View className="flex-row flex-wrap gap-x-4 gap-y-3">
          {AGING_BUCKETS.map((bucket) => (
            <View className="min-w-[96px] grow basis-[40%] gap-0.5 lg:basis-0" key={bucket}>
              <View className="flex-row items-center gap-1.5">
                <View aria-hidden className={cn("size-2 rounded-xs", bucketColors[bucket])} />
                <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
                  {t(`receivables.aging.buckets.${bucket}`)}
                </Text>
              </View>
              <Text className="font-ui text-[13px] leading-5 tabular-nums">
                {money(EXAMPLE_AGING[bucket].minorUnits)}
              </Text>
              <Text className="text-xs leading-4 text-muted-foreground">
                {t("receivables.aging.count", { count: EXAMPLE_AGING[bucket].accounts })}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </Surface>
  );
}

function PayablesPreview() {
  const { t } = useTranslation();
  const { dayMonth, money } = useExample();
  return (
    <Surface>
      <FigureStrip>
        <Figure
          detail={t("purchases.payables.openCount", { count: EXAMPLE_PAYABLES.purchases })}
          label={t("purchases.payables.owed")}
          value={money(EXAMPLE_PAYABLES.outstanding)}
        />
        <Divider />
        <Figure
          detail={t("operate.home.debtors.nothingOverdue")}
          label={t("purchases.payables.dueSoon")}
          tone="warning"
          value={money(EXAMPLE_PAYABLES.dueThisWeek)}
        />
      </FigureStrip>
      <TableHead>
        <Text className="min-w-0 flex-1 text-xs text-muted-foreground">
          {t("purchases.payables.columns.supplier")}
        </Text>
        <Text className="w-16 text-xs text-muted-foreground">
          {t("purchases.payables.columns.due")}
        </Text>
        <Text className="w-20 text-right text-xs text-muted-foreground">
          {t("purchases.payables.columns.balance")}
        </Text>
      </TableHead>
      {EXAMPLE_CREDITORS.map((creditor) => (
        <View
          className="min-h-12 flex-row items-center gap-3 border-t border-border px-4 py-2"
          key={creditor.name}
        >
          <View className="min-w-0 flex-1">
            <Text className="text-[13px] leading-5" numberOfLines={1}>
              {t(`welcome.sample.people.${creditor.name}`)}
            </Text>
            <Text className="text-xs leading-4 text-muted-foreground" numberOfLines={1}>
              {t("purchases.payables.invoice", { number: creditor.invoice })}
            </Text>
          </View>
          <Text className="w-16 text-[13px] text-muted-foreground tabular-nums">
            {dayMonth(creditor.dueInDays)}
          </Text>
          <Text className="w-20 text-right font-ui text-[13px] tabular-nums">
            {money(creditor.minorUnits)}
          </Text>
        </View>
      ))}
    </Surface>
  );
}

function ReportsPreview() {
  const { t } = useTranslation();
  const { locale, money, signedMoney, today } = useExample();
  const months = exampleCashFlow(today);
  const recent = months.slice(-3);
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
        <TableHead>
          <Text className="min-w-24 flex-1 text-xs text-muted-foreground">
            {t("reports.cashFlow.columns.month")}
          </Text>
          <Text className="w-24 text-right text-xs text-muted-foreground">
            {t("reports.cashFlow.columns.inflow")}
          </Text>
          {/* Visibility sits on a wrapper: a flex Text on the web ignores text-right. */}
          <View className="hidden w-24 xl:flex">
            <Text className="text-right text-xs text-muted-foreground">
              {t("reports.cashFlow.columns.outflow")}
            </Text>
          </View>
          <Text className="w-24 text-right text-xs text-muted-foreground">
            {t("reports.cashFlow.columns.net")}
          </Text>
        </TableHead>
        {recent.map((month) => (
          <View className="flex-row gap-3 border-t border-border px-4 py-2" key={month.month}>
            <Text className="min-w-24 flex-1 text-[13px]" numberOfLines={1}>
              {capitalizeFirst(formatMonthName(`${month.month}-01`, locale, "long"), locale)}
            </Text>
            <Text className="w-24 text-right text-[13px] tabular-nums">
              {money(month.inflowMinorUnits)}
            </Text>
            <View className="hidden w-24 xl:flex">
              <Text className="text-right text-[13px] text-muted-foreground tabular-nums">
                {money(`-${month.outflowMinorUnits}`)}
              </Text>
            </View>
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
            <Text className="text-[15px] leading-6 text-muted-foreground web:text-pretty">
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
