import type { CashMovement, CashMovementAction } from "@pisto/contracts";
import { Pressable, Text, View } from "react-native";

type CashMovementListProps = {
  movements: CashMovement[];
  noMovements: string;
  actionLabels: Record<CashMovementAction, string>;
  formatMoney: (minorUnits: string, currency: string, fractionDigits: number) => string;
  onOpenMovement?: (movementId: string) => void;
};

export function CashMovementList({
  movements,
  noMovements,
  actionLabels,
  formatMoney,
  onOpenMovement,
}: CashMovementListProps) {
  if (movements.length === 0) {
    return (
      <Text className="text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]">{noMovements}</Text>
    );
  }
  return (
    <View className="border-y border-line dark:border-[#304239]">
      {movements.map((movement) => (
        <Pressable
          accessibilityRole={onOpenMovement ? "button" : undefined}
          className="gap-2 border-b border-line py-4 last:border-b-0 dark:border-[#304239] sm:flex-row sm:items-baseline sm:justify-between"
          disabled={!onOpenMovement}
          key={movement.id}
          onPress={onOpenMovement ? () => onOpenMovement(movement.id) : undefined}
        >
          <View className="min-w-0 flex-1 gap-1">
            <Text className="font-bold text-ink dark:text-white">
              {actionLabels[movement.action]}
            </Text>
            <Text className="text-xs text-ink-muted dark:text-[#91A198]">
              {movement.occurredLocalDate} · {movement.occurredLocalTime}
            </Text>
          </View>
          <Text className="font-black text-ink dark:text-white">
            {formatMoney(
              movement.deltaMinorUnits,
              movement.currency,
              movement.currencyMinorUnitDigits,
            )}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
