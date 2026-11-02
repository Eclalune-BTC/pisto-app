import type { Movement } from "@pisto/contracts";
import { Link } from "expo-router";
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Icon } from "@/components/ui/icon";
import { PressableSurface } from "@/components/ui/pressable-surface";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { formatMinorUnits } from "@/lib/money";
import {
  entrySourceIcons,
  entrySourceLabel,
  isIncoming,
  movementHref,
  movementKindIcons,
  movementKindLabel,
  movementSubtitle,
  movementTitle,
} from "./presentation";

export type MovementRowFormat = {
  money: (minorUnits: string) => string;
  /** Signed: "+$5.00" for money in, "−$4.20" for money out. */
  signedMoney: (minorUnits: string) => string;
};

export function movementFormat(
  currency: string | undefined,
  digits: number | undefined,
  locale: string,
): MovementRowFormat | undefined {
  if (!currency || digits === undefined) return undefined;
  const money = (minorUnits: string) => formatMinorUnits(minorUnits, currency, digits, locale);
  return {
    money,
    signedMoney: (minorUnits) =>
      minorUnits.startsWith("-") || minorUnits === "0"
        ? money(minorUnits)
        : `+${money(minorUnits)}`,
  };
}

export function MovementIcon({ movement }: { movement: Movement }) {
  return (
    <View className="size-8 items-center justify-center rounded-full bg-muted">
      <Icon
        as={movementKindIcons[movement.kind]}
        className="text-foreground/80"
        size={15}
        strokeWidth={1.75}
      />
    </View>
  );
}

export function EntrySourceTag({ movement }: { movement: Movement }) {
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-1">
      <Icon
        as={entrySourceIcons[movement.entrySource]}
        className="text-muted-foreground"
        size={12}
        strokeWidth={1.75}
      />
      <Text className="text-xs text-muted-foreground">
        {entrySourceLabel(t, movement.entrySource)}
      </Text>
    </View>
  );
}

export function MovementAmount({
  className,
  format,
  movement,
}: {
  className?: string;
  format: MovementRowFormat;
  movement: Movement;
}) {
  return (
    <Text
      className={cn(
        "font-ui text-[13px] tabular-nums",
        isIncoming(movement) ? "text-positive-foreground" : "text-foreground",
        className,
      )}
      numberOfLines={1}
    >
      {format.signedMoney(movement.amountMinorUnits)}
    </Text>
  );
}

/** One sentence a screen reader hears for the whole row. */
export function movementAccessibilityLabel(
  t: ReturnType<typeof useTranslation>["t"],
  movement: Movement,
  format: MovementRowFormat,
): string {
  return [
    movementTitle(t, movement),
    movementSubtitle(t, movement, format.money),
    movement.occurredLocalTime,
    movementKindLabel(t, movement.kind),
    entrySourceLabel(t, movement.entrySource),
    movement.accountName,
    format.signedMoney(movement.amountMinorUnits),
  ]
    .filter(Boolean)
    .join(", ");
}

export function MovementLink({
  children,
  label,
  movement,
}: {
  children: ReactElement;
  label: string;
  movement: Movement;
}) {
  return (
    <Link asChild href={movementHref(movement)}>
      <PressableSurface accessibilityLabel={label} accessibilityRole="link">
        {children}
      </PressableSurface>
    </Link>
  );
}

/** Compact row: icon, title, time and source, amount. Used on the home and on phones. */
export function MovementRow({
  format,
  movement,
  showAccount = false,
}: {
  format: MovementRowFormat;
  movement: Movement;
  showAccount?: boolean;
}) {
  const { t } = useTranslation();
  const subtitle = movementSubtitle(t, movement, format.money);
  return (
    <MovementLink label={movementAccessibilityLabel(t, movement, format)} movement={movement}>
      <View className="min-h-14 flex-row items-center gap-3 px-4 py-2.5">
        <MovementIcon movement={movement} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="font-ui text-[13px] leading-5" numberOfLines={1}>
            {movementTitle(t, movement)}
          </Text>
          <View className="min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
            <Text className="text-xs leading-4 text-muted-foreground tabular-nums">
              {movement.occurredLocalTime}
            </Text>
            <EntrySourceTag movement={movement} />
            {subtitle ? (
              <Text
                className="min-w-0 shrink text-xs leading-4 text-muted-foreground"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {showAccount && movement.accountName ? (
          <Text
            className="hidden w-28 text-right text-xs text-muted-foreground md:flex"
            numberOfLines={1}
          >
            {movement.accountName}
          </Text>
        ) : null}
        <MovementAmount format={format} movement={movement} />
      </View>
    </MovementLink>
  );
}
