import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { movementFormat } from "@/features/movements/movement-row";
import { entrySourceIcons, isIncoming, movementKindIcons } from "@/features/movements/presentation";
import { formatLocalDayMonth } from "@/i18n/format";
import { requireSupportedLocale } from "@/i18n/locale";
import { cn } from "@/lib/cn";
import { currentLocalDateTime } from "@/lib/money";
import {
  EXAMPLE_CURRENCY,
  EXAMPLE_DIGITS,
  EXAMPLE_SALE,
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

/** A page section's H2 and the one sentence under it. */
export function SectionHeading({
  description,
  id,
  title,
}: {
  description: string;
  id: string;
  title: string;
}) {
  return (
    <View className="max-w-[640px] gap-4">
      <Heading className="web:scroll-mt-5" level={2} nativeID={id} size="display" tabIndex={-1}>
        {title}
      </Heading>
      <Text className="text-lg text-muted-foreground web:text-pretty">{description}</Text>
    </View>
  );
}

/** Each example movement worded with the Movimientos screen's own phrases. */
function useMovementCopy() {
  const { t } = useTranslation();
  const { money } = useExample();
  const person = (name: ExampleBalance["name"] | "santaRita") => t(`welcome.sample.people.${name}`);
  const lines = (count: number) => t("movements.facts.lines", { count });
  return (movement: ExampleMovement): { title: string; detail: string } => {
    switch (movement.key) {
      case "dictatedSale":
        return {
          title: t("movements.titles.saleTo", { name: person("rosa") }),
          detail: t("movements.facts.paidOf", {
            paid: money(EXAMPLE_SALE.received),
            total: money(EXAMPLE_SALE.total),
          }),
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
          // The separator keeps to the first fact, so a wrapped line never starts with it.
          detail: `${lines(5)} · ${t("movements.facts.paidOf", { paid: money("1000"), total: money("4370") })}`,
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
        <Text className="font-ui text-dense">{copy.title}</Text>
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
          <Text className="min-w-0 shrink text-xs leading-4 text-muted-foreground">
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
          "font-ui text-dense tabular-nums",
          incoming ? "text-positive-foreground" : "text-foreground",
        )}
        numberOfLines={1}
      >
        {signedMoney(movement.amountMinorUnits)}
      </Text>
    </View>
  );
}
