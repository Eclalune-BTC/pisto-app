import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { buttonTextVariants, buttonVariants } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { movementFormat } from "@/features/movements/movement-row";
import { entrySourceIcons, isIncoming, movementKindIcons } from "@/features/movements/presentation";
import { formatLocalDayMonth } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/initials";
import { currentLocalDateTime } from "@/lib/money";
import {
  EXAMPLE_CURRENCY,
  EXAMPLE_DIGITS,
  EXAMPLE_TIME_ZONE,
  type ExampleBalance,
  type ExampleMovement,
  shiftLocalDate,
} from "./example-business";

/** Formatting for the example business: its currency, the page locale and today in El Salvador. */
export function useExample() {
  const { i18n } = useTranslation();
  const locale = requireSupportedLocale(i18n.resolvedLanguage);
  const today = useMemo(() => currentLocalDateTime(EXAMPLE_TIME_ZONE).date, []);
  const format = movementFormat(EXAMPLE_CURRENCY, EXAMPLE_DIGITS, locale);
  if (!format) throw new Error("The example business has no currency.");
  return {
    locale,
    today,
    money: format.money,
    signedMoney: format.signedMoney,
    dayMonth: (offset: number) => formatLocalDayMonth(shiftLocalDate(today, offset), locale),
  };
}

/** A product surface as the app draws it: hairline border, 8 px radius, card fill. */
export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <View
      className={cn("min-w-0 overflow-hidden rounded-xl border border-border bg-card", className)}
    >
      {children}
    </View>
  );
}

/** A card title row with the quiet "Ver todo" the home cards carry. */
export function SurfaceHeader({ title, action }: { title: string; action?: string }) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="font-heading text-[15px] leading-5">{title}</Text>
      {action ? <Text className="text-xs text-muted-foreground">{action}</Text> : null}
    </View>
  );
}

/**
 * The look of a shared Button without its role: illustrations show the control a person would
 * press in the app, but on this page there is nothing to press.
 */
export function ButtonLook({
  icon,
  label,
  size = "sm",
  variant = "default",
}: {
  icon?: LucideIcon;
  label: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost";
}) {
  return (
    <View aria-hidden className={buttonVariants({ size, variant })}>
      {icon ? (
        <Icon
          as={icon}
          className={variant === "default" ? "text-primary-foreground" : "text-foreground"}
          size={14}
        />
      ) : null}
      <Text className={cn(buttonTextVariants({ variant }), "text-[13px]")}>{label}</Text>
    </View>
  );
}

/** Each example movement worded with the Movimientos screen's own phrases. */
export function useMovementCopy() {
  const { t } = useTranslation();
  const { money } = useExample();
  const person = (name: ExampleBalance["name"] | "santaRita") => t(`welcome.sample.people.${name}`);
  const lines = (count: number) => t("movements.facts.lines", { count });
  return (movement: ExampleMovement): { title: string; detail: string } => {
    switch (movement.key) {
      case "dictatedSale":
        return {
          title: t("movements.titles.saleTo", { name: person("carlos") }),
          detail: t("movements.facts.paidOf", { paid: money("500"), total: money("975") }),
        };
      case "rosaPayment":
        return {
          title: t("movements.titles.paymentFrom", { name: person("rosa") }),
          detail: t("movements.facts.accountPayment"),
        };
      case "electricity":
        return {
          title: t("welcome.sample.electricity"),
          detail: t("expenses.categories.utilities"),
        };
      case "bakeryPurchase":
        return {
          title: t("movements.titles.purchaseFrom", { name: person("santaRita") }),
          detail: lines(4),
        };
      case "counterSale":
        return { title: t("welcome.sample.counterSale"), detail: lines(3) };
      case "creditSale":
        return {
          title: t("movements.titles.saleTo", { name: person("comedor") }),
          detail: `${lines(5)} · ${t("movements.facts.paidOf", { paid: money("1000"), total: money("4370") })}`,
        };
      case "dairyPayment":
        return {
          title: t("movements.titles.paymentTo", { name: person("lacteos") }),
          detail: t("purchases.payables.invoice", { number: "F-1836" }),
        };
      case "rent":
        return { title: t("welcome.sample.rent"), detail: t("expenses.categories.rent") };
      case "pedroPayment":
        return {
          title: t("movements.titles.paymentFrom", { name: person("pedro") }),
          detail: t("movements.facts.accountPayment"),
        };
      case "morningSale":
        return { title: t("welcome.sample.counterSale"), detail: lines(6) };
    }
  };
}

/** One movement drawn like the app's compact movement row. */
export function MovementLine({
  className,
  movement,
  showKind = false,
}: {
  className?: string;
  movement: ExampleMovement;
  showKind?: boolean;
}) {
  const { t } = useTranslation();
  const { signedMoney } = useExample();
  const copy = useMovementCopy()(movement);
  const incoming = isIncoming(movement);
  return (
    <View className={cn("min-h-14 flex-row items-center gap-3 px-4 py-2.5", className)}>
      <View className="size-8 items-center justify-center rounded-full bg-muted">
        <Icon
          as={movementKindIcons[movement.kind]}
          className="text-foreground/80"
          size={15}
          strokeWidth={1.75}
        />
      </View>
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-ui text-[13px] leading-5" numberOfLines={1}>
          {copy.title}
        </Text>
        <View className="min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
          <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
            {movement.time}
          </Text>
          <View className="flex-row items-center gap-1">
            <Icon
              as={entrySourceIcons[movement.source]}
              className="text-muted-foreground"
              size={12}
              strokeWidth={1.75}
            />
            <Text className="text-xs text-muted-foreground">
              {t(`movements.sources.${movement.source}`)}
            </Text>
          </View>
          <Text
            className="min-w-0 shrink text-xs leading-4 text-muted-foreground"
            numberOfLines={1}
          >
            {copy.detail}
          </Text>
        </View>
      </View>
      {showKind ? (
        <Text className="hidden w-14 text-xs text-muted-foreground lg:flex" numberOfLines={1}>
          {t(`movements.kinds.${movement.kind}`)}
        </Text>
      ) : null}
      <Text
        className={cn(
          "font-ui text-[13px] tabular-nums",
          incoming ? "text-positive-foreground" : "text-foreground",
        )}
        numberOfLines={1}
      >
        {signedMoney(movement.amountMinorUnits)}
      </Text>
    </View>
  );
}

/**
 * A customer or supplier balance as the home lists it: name, due date and amount. The amount sits
 * on the name line so the due date keeps the row width in narrow cards.
 */
export function BalanceLine({
  balance,
  className,
  initials = true,
}: {
  balance: ExampleBalance;
  className?: string;
  initials?: boolean;
}) {
  const { t } = useTranslation();
  const { dayMonth, money } = useExample();
  const name = t(`welcome.sample.people.${balance.name}`);
  const overdue = balance.dueInDays < 0;
  return (
    <View className={cn("min-h-12 flex-row items-center gap-3 py-2", className)}>
      {initials ? (
        <View className="size-8 items-center justify-center rounded-full bg-muted">
          <Text className="font-ui text-[11px] text-muted-foreground">{initialsOf(name)}</Text>
        </View>
      ) : null}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-baseline justify-between gap-3">
          <Text className="min-w-0 shrink font-ui text-[13px] leading-5" numberOfLines={1}>
            {name}
          </Text>
          <Text className="font-ui text-[13px] leading-5 tabular-nums">
            {money(balance.minorUnits)}
          </Text>
        </View>
        <Text
          className={cn(
            "text-xs leading-4",
            overdue ? "text-warning-foreground" : "text-muted-foreground",
          )}
          numberOfLines={1}
        >
          {overdue
            ? t("operate.home.debtors.overdueSince", { date: dayMonth(balance.dueInDays) })
            : t("operate.home.debtors.dueOn", { date: dayMonth(balance.dueInDays) })}
        </Text>
      </View>
    </View>
  );
}

/** Balance rows divided by hairlines, with one above the first. */
export function BalanceList({
  balances,
  initials = true,
}: {
  balances: readonly ExampleBalance[];
  initials?: boolean;
}) {
  return (
    <View className="border-t border-border">
      {balances.map((balance, index) => (
        <BalanceLine
          balance={balance}
          className={cn(index > 0 && "border-t border-border")}
          initials={initials}
          key={balance.name}
        />
      ))}
    </View>
  );
}
