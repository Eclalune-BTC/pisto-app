import { House, type LucideIcon, Menu, Mic, PanelLeft, Plus, Store } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useWindowDimensions, View } from "react-native";
import { Brand } from "@/components/brand";
import { buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { operateModuleIcons } from "@/features/operate/module-icons";
import { MoneyFigure } from "@/features/operate/money-figure";
import {
  type MoneyFigureRow,
  MoneyFigureRows,
  MoneyFigureStrip,
} from "@/features/operate/money-figure-rows";
import { MoneyTrendChart } from "@/features/operate/money-trend-chart";
import { OPERATE_GROUPS, OPERATE_MODULES } from "@/features/operate/navigation";
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

/**
 * "Dinero disponible" as the wide home draws it: the balance and its month, and beside them the
 * accounts that hold it.
 */
function MoneyPanel() {
  const { t } = useTranslation();
  const { locale, money, dayMonth, today } = useExample();
  const trend = exampleMoneyTrend(today);
  const rows = useAccountFigures();
  return (
    <Surface className="md:flex-row">
      <View className="min-w-0 flex-1 gap-4 p-4">
        <View className="gap-1">
          <Text className="font-heading text-title">{t("operate.home.money.title")}</Text>
          <MoneyFigure
            className="text-figure-xl"
            currency={EXAMPLE_CURRENCY}
            fractionClassName="text-figure text-muted-foreground"
            fractionDigits={EXAMPLE_DIGITS}
            locale={locale}
            minorUnits={trend.closingMinorUnits}
          />
          <Text className="text-dense tabular-nums text-muted-foreground">
            <Text className="font-ui text-dense tabular-nums text-positive-foreground">
              {`+${money(trend.changeMinorUnits)}`}
            </Text>{" "}
            {t("operate.home.money.since", { date: dayMonth(-(trend.points.length - 1)) })}
          </Text>
        </View>
        <View aria-hidden>
          <MoneyTrendChart height={150} locale={locale} trend={trend} />
        </View>
      </View>
      <View className="gap-3 border-t border-border p-4 md:w-[250px] md:shrink-0 md:border-l md:border-t-0">
        <View className="flex-row items-center justify-between gap-2">
          <Text className="font-heading text-title">{t("operate.modules.cash.label")}</Text>
          <Text className="text-xs text-muted-foreground">{t("operate.home.today.all")}</Text>
        </View>
        <MoneyFigureRows figures={rows} />
      </View>
    </Surface>
  );
}

function TodayPanel() {
  const { t } = useTranslation();
  return (
    <Surface>
      <View className="px-4 pb-1 pt-3.5">
        <SurfaceHeader action={t("operate.home.today.all")} title={t("operate.home.today.title")} />
      </View>
      {EXAMPLE_MOVEMENTS.slice(0, 4).map((movement, index) => (
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

function PayablesPanel() {
  const { t } = useTranslation();
  const next = EXAMPLE_CREDITORS[0];
  if (!next) throw new Error("The example business needs a supplier balance.");
  return (
    <Surface className="flex-1 gap-3 p-4">
      <SurfaceHeader
        action={t("operate.home.payables.all")}
        title={t("operate.home.payables.title")}
      />
      <OwedFigure
        minorUnits={EXAMPLE_PAYABLES.outstanding}
        note={
          <Text className="text-xs text-muted-foreground">
            {t("operate.home.debtors.nothingOverdue")}
            {" · "}
            {t("operate.home.payables.purchases", { count: EXAMPLE_PAYABLES.purchases })}
          </Text>
        }
      />
      <View className="border-t border-border pt-2">
        <Text className="text-xs text-muted-foreground">{t("operate.home.payables.next")}</Text>
        <BalanceLine balance={next} className="min-h-0 pb-0 pt-0.5" initials={false} />
      </View>
    </Surface>
  );
}

function NavLook({
  active = false,
  icon,
  label,
}: {
  active?: boolean;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <View
      className={cn(
        "h-8 flex-row items-center gap-2.5 rounded-md border px-2",
        active ? "border-sidebar-border bg-card" : "border-transparent",
      )}
    >
      <Icon
        as={icon}
        className={active ? "text-primary" : "text-sidebar-foreground/70"}
        size={15}
        strokeWidth={1.75}
      />
      <Text
        className={cn(
          "text-dense",
          active ? "font-ui text-sidebar-accent-foreground" : "text-sidebar-foreground",
        )}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** The sidebar the app shows from tablet-landscape widths, drawn from the same module list. */
function SidebarLook() {
  const { t } = useTranslation();
  return (
    <View className="hidden w-[216px] shrink-0 gap-3 border-r border-sidebar-border bg-sidebar p-3 lg:flex">
      <View className="h-8 justify-center px-1">
        <Brand />
      </View>
      <View className="flex-row items-center gap-2.5 rounded-lg border border-sidebar-border bg-card p-2">
        <View className="size-8 items-center justify-center rounded-md bg-brand">
          <Icon as={Store} className="text-brand-foreground" size={15} />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-ui text-dense" numberOfLines={1}>
            {t("welcome.sample.business")}
          </Text>
          <Text className="text-micro text-muted-foreground">{EXAMPLE_CURRENCY}</Text>
        </View>
      </View>
      {OPERATE_GROUPS.map((group) => (
        <View className="gap-0.5" key={group.id}>
          {group.labelKey ? (
            <Text className="px-2 pb-1 pt-1.5 text-xs text-muted-foreground">
              {t(group.labelKey)}
            </Text>
          ) : (
            <NavLook active icon={House} label={t("shell.home")} />
          )}
          {OPERATE_MODULES.filter((module) => module.group === group.id).map((module) => (
            <NavLook
              icon={operateModuleIcons[module.id]}
              key={module.id}
              label={t(module.labelKey)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const COMPOSER_CHIPS = ["sale", "purchase", "expense", "payment"] as const;

/**
 * The home's "Registrar" composer, with nothing to press. `bar` is the wide home's layout: the
 * title beside the line. In `panel` the line takes a row of its own, because inside a pictured
 * phone it is narrower than on a real one and its placeholder would be cut.
 */
function ComposerLook({ layout = "panel" }: { layout?: "panel" | "bar" }) {
  const { t } = useTranslation();
  const bar = layout === "bar";
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
    <Surface className={cn("gap-3 p-4", bar && "flex-row items-center gap-8")}>
      <View className={cn("gap-0.5", bar && "w-[184px] shrink-0 xl:w-[200px]")}>
        <Text className="font-heading text-title">{t("assistant.composer.title")}</Text>
        <Text className="text-dense text-muted-foreground">
          {t("assistant.composer.description")}
        </Text>
      </View>
      {bar ? (
        <View className="min-w-0 flex-1 gap-3">
          <View className="flex-row items-center gap-2">
            {line}
            {microphone}
            {submit}
          </View>
          {chips}
        </View>
      ) : (
        <View className="gap-3">
          <View className="flex-row">{line}</View>
          {chips}
          <View className="flex-row gap-2">
            {microphone}
            <View className="flex-1">{submit}</View>
          </View>
        </View>
      )}
    </Surface>
  );
}

/**
 * The hero's picture of the product: the "Hoy" home of the example business inside the app's own
 * frame, composed from the same components and tokens as the real screen. The page crops it at
 * the fold, so it has no bottom edge of its own.
 */
export function ProductPreview() {
  const { t } = useTranslation();
  const date = useHomeDate();
  return (
    <View
      accessibilityLabel={t("welcome.preview.label")}
      className="pointer-events-none min-w-0 flex-row overflow-hidden rounded-t-2xl border border-b-0 border-border bg-background"
      role="figure"
    >
      <SidebarLook />
      <View className="min-w-0 flex-1">
        <View className="h-12 flex-row items-center justify-between gap-3 border-b border-border px-4">
          <View className="flex-row items-center gap-3">
            <View className="hidden lg:flex">
              <Icon as={PanelLeft} className="text-muted-foreground" size={16} />
            </View>
            <Text className="font-ui text-dense">{t("shell.home")}</Text>
          </View>
          <View className="flex-row gap-2">
            <ButtonLook icon={Plus} label={t("shell.newRecord.trigger")} variant="outline" />
            <ButtonLook icon={Mic} label={t("assistant.dictate")} />
          </View>
        </View>
        <View className="min-w-0 gap-5 p-4 sm:p-6">
          <View>
            <Text className="font-heading text-heading">{t("operate.home.title")}</Text>
            <Text className="text-sm text-muted-foreground" numberOfLines={1}>
              {date}
            </Text>
          </View>
          {/* The wide home's own order: the composer leads as a bar, then the money. */}
          <View className="min-w-0 gap-4">
            <ComposerLook layout="bar" />
            {/*
              On the widest screens the page stands the phone over this window's right side, from
              the money card down. These rows end 16 px short of it, so its edge never cuts a
              figure or a word: 283 px is how far the phone reaches into this column. What is left
              holds one card of balances without cutting its names, so "Por pagar" steps aside.
            */}
            <View className="min-w-0 gap-4 xl:mr-[299px]">
              <MoneyPanel />
              <View className="min-w-0 flex-row gap-4">
                <DebtorsPanel />
                <View className="min-w-0 flex-1 xl:hidden">
                  <PayablesPanel />
                </View>
              </View>
              <TodayPanel />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * The same home at phone width, where the money sits on the lime card. `cropped` runs on under
 * the edge of the stage that holds it; `closed` is the whole picture on a phone, so its frame ends
 * after the composer. A closed frame sits inside the page's own gutters, so it takes a narrower
 * gutter of its own: the two account figures need 240 px to share a line on a 360 px screen.
 */
export function PhonePreview({
  className,
  frame = "cropped",
}: {
  className?: string;
  frame?: "cropped" | "closed";
}) {
  const { t } = useTranslation();
  const { locale, money, dayMonth, today } = useExample();
  const trend = exampleMoneyTrend(today);
  const date = useHomeDate();
  const figures = useAccountFigures();
  const closed = frame === "closed";
  const { width } = useWindowDimensions();
  // Below 360 px the pictured card is too narrow for both account figures on one line, and the
  // strip would wrap with its divider left in front of the second one.
  const stacked = closed && width > 0 && width < 360;
  return (
    <View
      accessibilityLabel={t("welcome.preview.phoneLabel")}
      className={cn(
        "pointer-events-none min-w-0 overflow-hidden border border-border bg-background",
        closed ? "rounded-2xl" : "rounded-t-2xl border-b-0",
        className,
      )}
      role="figure"
    >
      <View
        className={cn(
          "h-12 flex-row items-center justify-between gap-3 border-b border-border",
          closed ? "px-3" : "px-4",
        )}
      >
        <View className="flex-row items-center gap-3">
          <Icon as={Menu} className="text-foreground" size={18} />
          <Text className="font-ui text-dense">{t("shell.home")}</Text>
        </View>
        <ButtonLook icon={Mic} label={t("assistant.dictate")} />
      </View>
      <View className={cn("gap-4", closed ? "p-3" : "p-4")}>
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
          {stacked ? (
            <View>
              {figures.map((figure) => (
                <View
                  className="flex-row items-baseline justify-between gap-3 border-t border-highlight-foreground/15 py-2"
                  key={figure.key}
                >
                  <Text className="text-xs text-highlight-foreground/70">{figure.label}</Text>
                  <Text className="font-heading text-lg leading-6 tabular-nums text-highlight-foreground">
                    {figure.value}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <MoneyFigureStrip figures={figures} />
          )}
        </View>
        <ComposerLook />
        {closed ? null : (
          <View>
            <DebtorsPanel />
          </View>
        )}
      </View>
    </View>
  );
}
