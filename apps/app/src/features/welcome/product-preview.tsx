import { Menu, Mic } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { MoneyFigure } from "@/features/operate/money-figure";
import { type MoneyFigureRow, MoneyFigureStrip } from "@/features/operate/money-figure-rows";
import { MoneyTrendChart } from "@/features/operate/money-trend-chart";
import { formatLocalDateFull } from "@/i18n/format";
import { cn } from "@/lib/cn";
import {
  EXAMPLE_ACCOUNTS,
  EXAMPLE_CURRENCY,
  EXAMPLE_DEBTORS,
  EXAMPLE_DIGITS,
  EXAMPLE_RECEIVABLES,
  exampleMoneyTrend,
} from "./example-business";
import { BalanceList, ButtonLook, Surface, SurfaceHeader, useExample } from "./fragments";

/** The example business's money by account kind, as both sizes of the home list it. */
function useAccountFigures(): MoneyFigureRow[] {
  const { t } = useTranslation();
  const { money } = useExample();
  return [
    {
      key: "cash",
      label: t("operate.home.money.kinds.cash"),
      value: money(EXAMPLE_ACCOUNTS.cash),
    },
    {
      key: "bank",
      label: t("operate.home.money.kinds.bank"),
      value: money(EXAMPLE_ACCOUNTS.bank),
    },
  ];
}

/** The page date as the home writes it under "Hoy". */
function useHomeDate(): string {
  const { locale, today } = useExample();
  const date = formatLocalDateFull(today, locale);
  return date.charAt(0).toLocaleUpperCase(locale) + date.slice(1);
}

function OwedFigure({ minorUnits, note }: { minorUnits: string; note: ReactNode }) {
  const { locale } = useExample();
  return (
    <View className="gap-0.5">
      <MoneyFigure
        className="text-figure-lg"
        currency={EXAMPLE_CURRENCY}
        fractionClassName="text-lg text-muted-foreground"
        fractionDigits={EXAMPLE_DIGITS}
        locale={locale}
        minorUnits={minorUnits}
      />
      {note}
    </View>
  );
}

function DebtorsPanel() {
  const { t } = useTranslation();
  const { money } = useExample();
  return (
    <Surface className="flex-1 gap-3 p-4">
      <SurfaceHeader
        action={t("operate.home.debtors.all")}
        title={t("operate.home.debtors.title")}
      />
      <OwedFigure
        minorUnits={EXAMPLE_RECEIVABLES.outstanding}
        note={
          <Text className="text-xs text-destructive">
            {t("operate.home.money.overdue", { amount: money(EXAMPLE_RECEIVABLES.overdue) })}
            {" · "}
            <Text className="text-xs text-muted-foreground">
              {t("operate.home.debtors.customers", { count: EXAMPLE_RECEIVABLES.customers })}
            </Text>
          </Text>
        }
      />
      <BalanceList balances={EXAMPLE_DEBTORS} />
    </Surface>
  );
}

const COMPOSER_CHIPS = ["sale", "purchase", "expense", "payment"] as const;

function ComposerLook() {
  const { t } = useTranslation();
  const line = (
    <View className="min-h-9 min-w-0 flex-1 justify-center rounded-lg border border-input bg-card px-3">
      <Text className="text-sm text-muted-foreground">{t("assistant.composer.placeholder")}</Text>
    </View>
  );
  const microphone = (
    <View aria-hidden className={buttonVariants({ size: "icon", variant: "outline" })}>
      <Icon as={Mic} className="text-foreground" size={16} />
    </View>
  );
  const submit = <ButtonLook label={t("assistant.composer.submit")} size="default" />;
  const chips = (
    <View className="flex-row flex-wrap gap-1.5">
      {COMPOSER_CHIPS.map((chip) => (
        <ButtonLook key={chip} label={t(`assistant.composer.chips.${chip}`)} variant="outline" />
      ))}
    </View>
  );
  return (
    <Surface className="gap-3 p-4">
      <View className="gap-0.5">
        <Text className="font-heading text-title">{t("assistant.composer.title")}</Text>
        <Text className="text-dense text-muted-foreground">
          {t("assistant.composer.description")}
        </Text>
      </View>
      <View className="gap-3">
        <View className="flex-row">{line}</View>
        {chips}
        <View className="flex-row gap-2">
          {microphone}
          <View className="flex-1">{submit}</View>
        </View>
      </View>
    </Surface>
  );
}

export function ProductPreview() {
  const { t } = useTranslation();
  const { locale, today } = useExample();
  const trend = exampleMoneyTrend(today);
  const figures = useAccountFigures();
  const date = useHomeDate();
  return (
    <View
      accessibilityLabel={t("welcome.preview.label")}
      role="figure"
      className="min-w-0 gap-5 rounded-2xl border border-border bg-card p-4 sm:gap-6 sm:p-6"
    >
      <View className="flex-row flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border pb-4">
        <Text className="font-ui text-sm">{t("welcome.sample.business")}</Text>
        <Text className="text-xs text-muted-foreground">{t("welcome.preview.example")}</Text>
      </View>
      <View className="gap-1">
        <Text className="font-ui text-title">{t("operate.home.money.title")}</Text>
        <MoneyFigure
          className="text-figure-xl"
          currency={EXAMPLE_CURRENCY}
          fractionClassName="text-figure text-muted-foreground"
          fractionDigits={EXAMPLE_DIGITS}
          locale={locale}
          minorUnits={trend.closingMinorUnits}
        />
        <Text className="text-xs text-muted-foreground">{date}</Text>
      </View>
      <MoneyTrendChart height={104} locale={locale} trend={trend} />
      <View className="flex-row gap-4 border-t border-border pt-3">
        {figures.map((figure) => (
          <View key={figure.key} className="min-w-0 flex-1">
            <Text className="text-xs text-muted-foreground">{figure.label}</Text>
            <Text className="font-heading text-title-lg tabular-nums">{figure.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** The cropped home shown beside the account form. */
export function PhonePreview({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { locale, money, dayMonth, today } = useExample();
  const trend = exampleMoneyTrend(today);
  const date = useHomeDate();
  const figures = useAccountFigures();
  return (
    <View
      accessibilityLabel={t("welcome.preview.phoneLabel")}
      className={cn(
        "pointer-events-none min-w-0 overflow-hidden rounded-t-2xl border border-b-0 border-border bg-background",
        className,
      )}
      role="figure"
    >
      <View className="h-12 flex-row items-center justify-between gap-3 border-b border-border px-4">
        <View className="flex-row items-center gap-3">
          <Icon as={Menu} className="text-foreground" size={18} />
          <Text className="font-ui text-dense">{t("shell.home")}</Text>
        </View>
        <ButtonLook icon={Mic} label={t("assistant.dictate")} />
      </View>
      <View className="gap-4 p-4">
        <View>
          <Text className="font-heading text-heading">{t("operate.home.title")}</Text>
          <Text className="text-sm text-muted-foreground">{date}</Text>
        </View>
        <View className="gap-4 rounded-xl bg-highlight p-4">
          <Text className="font-heading text-title text-highlight-foreground">
            {t("operate.home.money.title")}
          </Text>
          <View className="gap-1">
            <MoneyFigure
              className="text-figure-xl text-highlight-foreground"
              currency={EXAMPLE_CURRENCY}
              fractionClassName="text-figure text-highlight-foreground/60"
              fractionDigits={EXAMPLE_DIGITS}
              locale={locale}
              minorUnits={trend.closingMinorUnits}
            />
            <Text className="text-dense tabular-nums text-highlight-foreground/75">
              <Text className="font-ui text-dense tabular-nums text-highlight-foreground">
                {`+${money(trend.changeMinorUnits)}`}
              </Text>{" "}
              {t("operate.home.money.since", { date: dayMonth(-(trend.points.length - 1)) })}
            </Text>
          </View>
          <View aria-hidden>
            <MoneyTrendChart height={110} locale={locale} tone="highlight" trend={trend} />
          </View>
          <MoneyFigureStrip figures={figures} />
        </View>
        <ComposerLook />
        <View>
          <DebtorsPanel />
        </View>
      </View>
    </View>
  );
}
