import { ArrowLeft, ArrowRight } from "lucide-react-native";
import { type ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, View } from "react-native";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/ui/filter-bar";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import { CashFlowChart } from "@/features/reports/cash-flow-chart";
import { capitalizeFirst } from "@/features/reports/report-figures";
import { formatLocalDateFull, formatMonthName } from "@/i18n/format";
import { cn } from "@/lib/cn";
import closePhoto from "../../../assets/welcome/closing.jpg";
import deliveryPhoto from "../../../assets/welcome/delivery.jpg";
import notebookPhoto from "../../../assets/welcome/notebook.jpg";
import tillPhoto from "../../../assets/welcome/till.jpg";
import {
  type AgingBucket,
  EXAMPLE_AGING,
  EXAMPLE_CREDITORS,
  EXAMPLE_MOVEMENTS,
  EXAMPLE_PAYABLES,
  EXAMPLE_RECEIVABLES,
  EXAMPLE_YESTERDAY,
  exampleCashFlow,
  movementTotals,
  shiftLocalDate,
} from "./example-business";
import { MovementLine, useExample } from "./fragments";

export const MODULES = ["movements", "reports", "receivables", "payables"] as const;
type Module = (typeof MODULES)[number];
const photos = {
  movements: tillPhoto,
  reports: closePhoto,
  receivables: notebookPhoto,
  payables: deliveryPhoto,
};

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
    <View className="min-w-0 flex-1 gap-0.5">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text
        className={cn(
          "font-heading text-figure tabular-nums",
          tone === "destructive" && "text-destructive",
          tone === "warning" && "text-warning-foreground",
        )}
        numberOfLines={1}
      >
        {value}
      </Text>
      {detail ? (
        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** Two figures side by side over the hairline that starts the detail below them. */
function FigureStrip({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-6 border-b border-border pb-4">{children}</View>;
}

function TableHead({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-3 border-b border-border py-2">{children}</View>;
}

function MovementsPreview() {
  const { t } = useTranslation();
  const { locale, money, signedMoney, today } = useExample();
  const [period, setPeriod] = useState<"today" | "yesterday">("today");
  const rows = period === "today" ? EXAMPLE_MOVEMENTS : EXAMPLE_YESTERDAY;
  const totals = movementTotals(rows);
  const day = formatLocalDateFull(period === "today" ? today : shiftLocalDate(today, -1), locale, {
    year: false,
  });
  return (
    <View className="min-w-0">
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border pb-2">
        <View className="max-w-full flex-row flex-wrap items-center gap-2">
          <Text className="font-ui text-dense">{capitalizeFirst(day, locale)}</Text>
          <FilterBar
            label={t("welcome.modules.day")}
            value={period}
            onChange={setPeriod}
            options={[
              { value: "today", label: t("welcome.modules.today") },
              { value: "yesterday", label: t("welcome.modules.yesterday") },
            ]}
          />
        </View>
        <Text className="text-xs tabular-nums text-muted-foreground">
          {t("movements.totals.day", {
            inflow: signedMoney(totals.inflow),
            outflow: money(`-${totals.outflow}`),
          })}
        </Text>
      </View>
      {rows.map((movement, index) => (
        <MovementLine
          className={cn("px-0", index > 0 && "border-t border-border")}
          key={movement.key}
          movement={movement}
          showKind
        />
      ))}
    </View>
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
    <View className="min-w-0 gap-5">
      <FigureStrip>
        <Figure
          detail={t("operate.home.debtors.customers", { count: EXAMPLE_RECEIVABLES.customers })}
          label={t("receivables.summary.outstanding")}
          value={money(EXAMPLE_RECEIVABLES.outstanding)}
        />
        <Figure
          detail={t("receivables.aging.count", { count: overdueAccounts })}
          label={t("receivables.summary.overdue")}
          tone="destructive"
          value={money(EXAMPLE_RECEIVABLES.overdue)}
        />
      </FigureStrip>
      <View className="gap-3">
        <View className="flex-row flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
          <Text className="font-ui text-dense">{t("receivables.aging.title")}</Text>
          <Text className="text-xs text-muted-foreground">{t("receivables.aging.scope")}</Text>
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
        {/* Two marks per line at every width: four across would end the cell short of its pair. */}
        <View className="flex-row flex-wrap gap-x-4 gap-y-3">
          {AGING_BUCKETS.map((bucket) => (
            <View className="min-w-[96px] grow basis-[40%] gap-0.5" key={bucket}>
              <View className="flex-row items-center gap-1.5">
                <View aria-hidden className={cn("size-2 rounded-xs", bucketColors[bucket])} />
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {t(`receivables.aging.buckets.${bucket}`)}
                </Text>
              </View>
              <Text className="font-ui text-dense tabular-nums">
                {money(EXAMPLE_AGING[bucket].minorUnits)}
              </Text>
              <Text className="text-xs text-muted-foreground">
                {t("receivables.aging.count", { count: EXAMPLE_AGING[bucket].accounts })}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function PayablesPreview() {
  const { t } = useTranslation();
  const { dayMonth, money } = useExample();
  return (
    <View className="min-w-0">
      <FigureStrip>
        <Figure
          detail={t("purchases.payables.openCount", { count: EXAMPLE_PAYABLES.purchases })}
          label={t("purchases.payables.owed")}
          value={money(EXAMPLE_PAYABLES.outstanding)}
        />
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
      {EXAMPLE_CREDITORS.map((creditor, index) => (
        <View
          className={cn(
            "min-h-12 flex-row items-center gap-3 py-2",
            index > 0 && "border-t border-border",
          )}
          key={creditor.name}
        >
          <View className="min-w-0 flex-1">
            <Text className="text-dense">{t(`welcome.sample.people.${creditor.name}`)}</Text>
            <Text className="text-xs text-muted-foreground" numberOfLines={1}>
              {t("purchases.payables.invoice", { number: creditor.invoice })}
            </Text>
          </View>
          <Text className="w-16 text-dense tabular-nums text-muted-foreground">
            {dayMonth(creditor.dueInDays)}
          </Text>
          <Text className="w-20 text-right font-ui text-dense tabular-nums">
            {money(creditor.minorUnits)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function ReportsPreview() {
  const { t } = useTranslation();
  const { locale, money, signedMoney, today } = useExample();
  const months = exampleCashFlow(today);
  const recent = months.slice(-3);
  return (
    <View className="min-w-0 gap-4">
      <View className="flex-row flex-wrap items-center justify-between gap-2">
        <Text className="font-ui text-dense">{t("reports.cashFlow.title")}</Text>
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
      <View>
        <TableHead>
          <Text className="min-w-24 flex-1 text-xs text-muted-foreground">
            {t("reports.cashFlow.columns.month")}
          </Text>
          <Text className="w-24 text-right text-xs text-muted-foreground">
            {t("reports.cashFlow.columns.inflow")}
          </Text>
          <Text className="w-24 text-right text-xs text-muted-foreground">
            {t("reports.cashFlow.columns.outflow")}
          </Text>
          {/*
            The two bars of a month are what entered and what left, so those figures always show;
            their difference joins them where there is room. Visibility sits on a wrapper: a flex
            Text on the web ignores text-right.
          */}
          <View className="hidden w-24 xl:flex">
            <Text className="text-right text-xs text-muted-foreground">
              {t("reports.cashFlow.columns.net")}
            </Text>
          </View>
        </TableHead>
        {recent.map((month, index) => (
          <View
            className={cn("flex-row gap-3 py-2", index > 0 && "border-t border-border")}
            key={month.month}
          >
            <Text className="min-w-24 flex-1 text-dense" numberOfLines={1}>
              {capitalizeFirst(formatMonthName(`${month.month}-01`, locale, "long"), locale)}
            </Text>
            <Text className="w-24 text-right text-dense tabular-nums">
              {money(month.inflowMinorUnits)}
            </Text>
            <Text className="w-24 text-right text-dense tabular-nums text-muted-foreground">
              {money(`-${month.outflowMinorUnits}`)}
            </Text>
            <View className="hidden w-24 xl:flex">
              <Text className="text-right font-ui text-dense tabular-nums">
                {signedMoney(month.netMinorUnits)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const previews: Record<(typeof MODULES)[number], () => ReactNode> = {
  movements: () => <MovementsPreview />,
  receivables: () => <ReceivablesPreview />,
  payables: () => <PayablesPreview />,
  reports: () => <ReportsPreview />,
};

export function ModulePreviews() {
  const { t } = useTranslation();
  const [active, setActive] = useState<Module>(MODULES[0]);
  const [direction, setDirection] = useState<"next" | "previous">("next");
  const start = useRef<{ x: number; y: number } | null>(null);
  const index = MODULES.indexOf(active);

  function select(value: string) {
    const module = MODULES.find((item) => item === value);
    if (!module || module === active) return;
    setDirection(MODULES.indexOf(module) > index ? "next" : "previous");
    setActive(module);
  }

  function move(delta: number) {
    const module = MODULES[index + delta];
    if (module) select(module);
  }

  return (
    <Tabs value={active} onValueChange={select} className="min-w-0 gap-0">
      <View className="flex-row flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-border pb-2">
        <TabsList
          accessibilityLabel={t("welcome.nav.modules")}
          className="max-w-full flex-row flex-wrap justify-start gap-x-3 gap-y-0 rounded-none border-0 bg-transparent p-0 sm:gap-x-7"
        >
          {MODULES.map((module) => (
            <TabsTrigger
              className={cn(
                "min-h-11 rounded-none border-b-2 bg-transparent px-0 shadow-none web:cursor-pointer dark:bg-transparent",
                active === module ? "border-foreground" : "border-transparent",
              )}
              key={module}
              value={module}
            >
              <Text className="text-sm sm:text-base">
                {t(`welcome.modules.items.${module}.tab`)}
              </Text>
            </TabsTrigger>
          ))}
        </TabsList>
        <View className="flex-row items-center gap-1">
          <Text
            accessibilityLiveRegion="polite"
            aria-live="polite"
            className="mr-2 text-sm tabular-nums text-muted-foreground"
          >
            {t("welcome.modules.position", { current: index + 1, total: MODULES.length })}
          </Text>
          <Button
            accessibilityLabel={t("welcome.modules.previous")}
            disabled={index === 0}
            onPress={() => move(-1)}
            size="icon"
            variant="outline"
          >
            <Icon as={ArrowLeft} className="text-foreground" size={18} />
          </Button>
          <Button
            accessibilityLabel={t("welcome.modules.next")}
            disabled={index === MODULES.length - 1}
            onPress={() => move(1)}
            size="icon"
            variant="outline"
          >
            <Icon as={ArrowRight} className="text-foreground" size={18} />
          </Button>
        </View>
      </View>
      {MODULES.map((module) => (
        <TabsContent key={module} tabIndex={0} value={module}>
          <View
            className={cn(
              "min-w-0 gap-5 pt-5 web:touch-pan-y md:flex-row md:items-stretch md:gap-8 lg:gap-12 lg:pt-7",
              direction === "next" ? "pisto-slide-next" : "pisto-slide-previous",
            )}
            onTouchStart={({ nativeEvent }) => {
              const point = nativeEvent.touches[0];
              start.current =
                point && nativeEvent.touches.length === 1
                  ? { x: point.pageX, y: point.pageY }
                  : null;
            }}
            onTouchCancel={() => {
              start.current = null;
            }}
            onTouchEnd={({ nativeEvent }) => {
              const from = start.current;
              start.current = null;
              const point = nativeEvent.changedTouches[0];
              if (!from || !point || nativeEvent.touches.length) return;
              const dx = point.pageX - from.x;
              const dy = point.pageY - from.y;
              if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
            }}
          >
            <View className="h-[170px] overflow-hidden bg-muted sm:h-[232px] md:h-auto md:min-h-[340px] md:w-[37%]">
              <Image
                accessible={false}
                resizeMode="cover"
                source={photos[module]}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </View>
            <View className="min-w-0 flex-1 gap-5 pb-2 md:py-2 lg:gap-6">
              <View className="gap-2">
                <Heading level={3} size="marketing">
                  {t(`welcome.modules.items.${module}.title`)}
                </Heading>
                <Text className="text-base text-muted-foreground">
                  {t(`welcome.modules.items.${module}.description`)}
                </Text>
              </View>
              <View
                accessibilityLabel={t(`welcome.modules.items.${module}.figure`)}
                className="min-w-0 border-t border-border pt-4"
                role="figure"
              >
                {previews[module]()}
              </View>
            </View>
          </View>
        </TabsContent>
      ))}
    </Tabs>
  );
}
