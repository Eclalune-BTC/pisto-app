import { Mic, Plus } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { useUniwind } from "uniwind";
import { Text } from "@/components/ui/text";
import { MoneyFigure } from "@/features/operate/money-figure";
import { MoneyTrendChart } from "@/features/operate/money-trend-chart";
import { formatLocalDateFull } from "@/i18n/format";
import { cn } from "@/lib/cn";
import {
  EXAMPLE_ACCOUNTS,
  EXAMPLE_CREDITORS,
  EXAMPLE_CURRENCY,
  EXAMPLE_DEBTORS,
  EXAMPLE_DIGITS,
  EXAMPLE_MOVEMENTS,
  EXAMPLE_PAYABLES,
  EXAMPLE_RECEIVABLES,
  exampleMoneyTrend,
} from "./example-business";
import {
  BalanceLine,
  BalanceList,
  ButtonLook,
  MovementLine,
  Surface,
  SurfaceHeader,
  useExample,
} from "./fragments";

/**
 * "Dinero disponible" as the phone home draws it: the lime card. The dark palette has no lime
 * surface that keeps the chart line legible, so dark mode uses the card the wide home uses.
 */
export function MoneyPanel({ chartHeight = 96 }: { chartHeight?: number }) {
  const { t } = useTranslation();
  const { locale, money, dayMonth, today } = useExample();
  const lime = useUniwind().theme !== "dark";
  const trend = exampleMoneyTrend(today);
  const muted = lime ? "text-highlight-foreground/70" : "text-muted-foreground";
  const strong = lime ? "text-highlight-foreground" : "text-foreground";
  const rule = lime ? "border-highlight-foreground/15" : "border-border";
  return (
    <View
      className={cn(
        "min-w-0 gap-3 rounded-xl p-4",
        lime ? "bg-highlight" : "border border-border bg-card",
      )}
    >
      <Text className={cn("text-[13px]", muted)}>{t("operate.home.money.title")}</Text>
      <View className="gap-0.5">
        <MoneyFigure
          className={cn("text-[34px] leading-10 tracking-[-1.1px]", strong)}
          currency={EXAMPLE_CURRENCY}
          fractionClassName={cn("text-[20px] tracking-[-0.4px]", muted)}
          fractionDigits={EXAMPLE_DIGITS}
          locale={locale}
          minorUnits={trend.closingMinorUnits}
        />
        <Text className={cn("text-[13px] tabular-nums", muted)}>
          <Text
            className={cn(
              "font-ui text-[13px] tabular-nums",
              lime ? strong : "text-positive-foreground",
            )}
          >
            {`+${money(trend.changeMinorUnits)}`}
          </Text>{" "}
          {t("operate.home.money.since", { date: dayMonth(-(trend.points.length - 1)) })}
        </Text>
      </View>
      <View aria-hidden>
        <MoneyTrendChart
          height={chartHeight}
          locale={locale}
          tone={lime ? "highlight" : "card"}
          trend={trend}
        />
      </View>
      <View className={cn("flex-row border-t pt-3", rule)}>
        {(["cash", "bank"] as const).map((kind, index) => (
          <View
            className={cn("min-w-0 flex-1 gap-0.5", index > 0 && cn("border-l pl-4", rule))}
            key={kind}
          >
            <Text className={cn("text-xs leading-4", muted)}>
              {t(`operate.home.money.kinds.${kind}`)}
            </Text>
            <Text className={cn("font-heading text-[15px] leading-5 tabular-nums", strong)}>
              {money(EXAMPLE_ACCOUNTS[kind])}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TodayPanel({ rows = 3, showKind = false }: { rows?: number; showKind?: boolean }) {
  const { t } = useTranslation();
  return (
    <Surface>
      <View className="px-4 pb-1 pt-3.5">
        <SurfaceHeader action={t("operate.home.today.all")} title={t("operate.home.today.title")} />
      </View>
      {EXAMPLE_MOVEMENTS.slice(0, rows).map((movement, index) => (
        <MovementLine
          className={cn(index > 0 && "border-t border-border")}
          key={movement.key}
          movement={movement}
          showKind={showKind}
        />
      ))}
    </Surface>
  );
}

function OwedFigure({ minorUnits, note }: { minorUnits: string; note: React.ReactNode }) {
  const { locale } = useExample();
  return (
    <View className="gap-0.5">
      <MoneyFigure
        className="text-[24px] leading-8 tracking-[-0.6px]"
        currency={EXAMPLE_CURRENCY}
        fractionClassName="text-[15px] text-muted-foreground"
        fractionDigits={EXAMPLE_DIGITS}
        locale={locale}
        minorUnits={minorUnits}
      />
      {note}
    </View>
  );
}

export function DebtorsPanel() {
  const { t } = useTranslation();
  const { money } = useExample();
  return (
    <Surface className="gap-3 p-4">
      <SurfaceHeader
        action={t("operate.home.debtors.all")}
        title={t("operate.home.debtors.title")}
      />
      <OwedFigure
        minorUnits={EXAMPLE_RECEIVABLES.outstanding}
        note={
          <Text className="text-xs leading-4 text-warning-foreground">
            {t("operate.home.money.overdue", { amount: money(EXAMPLE_RECEIVABLES.overdue) })}
            {" · "}
            <Text className="text-xs leading-4 text-muted-foreground">
              {t("operate.home.debtors.customers", { count: EXAMPLE_RECEIVABLES.customers })}
            </Text>
          </Text>
        }
      />
      <BalanceList balances={EXAMPLE_DEBTORS} />
    </Surface>
  );
}

export function PayablesPanel() {
  const { t } = useTranslation();
  const next = EXAMPLE_CREDITORS[0];
  if (!next) throw new Error("The example business needs a supplier balance.");
  return (
    <Surface className="gap-3 p-4">
      <SurfaceHeader
        action={t("operate.home.payables.all")}
        title={t("operate.home.payables.title")}
      />
      <OwedFigure
        minorUnits={EXAMPLE_PAYABLES.outstanding}
        note={
          <Text className="text-xs leading-4 text-muted-foreground">
            {t("operate.home.debtors.nothingOverdue")}
            {" · "}
            {t("operate.home.payables.purchases", { count: EXAMPLE_PAYABLES.purchases })}
          </Text>
        }
      />
      <View className="border-t border-border pt-2">
        <Text className="text-xs leading-4 text-muted-foreground">
          {t("operate.home.payables.next")}
        </Text>
        <BalanceLine balance={next} className="min-h-0 pb-0 pt-0.5" initials={false} />
      </View>
    </Surface>
  );
}

/**
 * The hero's picture of the product: the "Hoy" home of the example business, composed from the
 * same components and tokens as the real screen, on the brand's forest-green stage.
 */
export function ProductPreview() {
  const { t } = useTranslation();
  const { locale, today } = useExample();
  const date = formatLocalDateFull(today, locale);
  return (
    <View
      accessibilityLabel={t("welcome.preview.label")}
      className="min-w-0 gap-2.5 rounded-xl bg-primary p-2 dark:border dark:border-border dark:bg-card sm:p-3"
      role="figure"
    >
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1.5 pt-0.5">
        <Text className="font-ui text-[13px] text-primary-foreground dark:text-foreground">
          {t("welcome.sample.business")}
        </Text>
        <Text className="text-xs text-primary-foreground/70 dark:text-muted-foreground">
          {t("welcome.preview.example")}
        </Text>
      </View>
      <View className="pointer-events-none min-w-0 gap-4 rounded-lg bg-background p-3 sm:p-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="font-heading text-xl leading-7 tracking-[-0.3px]">
              {t("operate.home.title")}
            </Text>
            <Text className="text-[13px] leading-5 text-muted-foreground" numberOfLines={1}>
              {date.charAt(0).toLocaleUpperCase(locale) + date.slice(1)}
            </Text>
          </View>
          <View className="flex-row gap-2">
            <View className="hidden sm:flex">
              <ButtonLook icon={Plus} label={t("shell.newRecord.trigger")} variant="outline" />
            </View>
            <ButtonLook icon={Mic} label={t("assistant.dictate")} />
          </View>
        </View>
        <View className="min-w-0 gap-3 sm:flex-row sm:items-start">
          <View className="min-w-0 flex-1 gap-3">
            <MoneyPanel />
            <TodayPanel />
          </View>
          <View className="hidden w-[248px] shrink-0 gap-3 sm:flex">
            <DebtorsPanel />
            <PayablesPanel />
          </View>
        </View>
      </View>
    </View>
  );
}
