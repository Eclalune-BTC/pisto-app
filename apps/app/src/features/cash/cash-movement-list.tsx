import type { CashMovement, CashMovementAction } from "@pisto/contracts";
import { Text, View } from "react-native";
import { Button } from "@/components/ui/button";

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
    return <Text className="text-sm leading-5 text-muted-foreground">{noMovements}</Text>;
  }
  return (
    <View className="border-y border-border">
      {movements.map((movement) => {
        const content = (
          <>
            <View className="min-w-0 flex-1 gap-1">
              <Text className="font-bold text-foreground">{actionLabels[movement.action]}</Text>
              <Text className="text-xs text-ink-muted dark:text-[#91A198]">
                {movement.occurredLocalDate} · {movement.occurredLocalTime}
              </Text>
            </View>
            <Text className="font-black text-foreground">
              {formatMoney(
                movement.deltaMinorUnits,
                movement.currency,
                movement.currencyMinorUnitDigits,
              )}
            </Text>
          </>
        );
        const className =
          "flex-col items-stretch justify-start gap-2 rounded-none border-b border-line px-0 py-4 last:border-b-0 dark:border-[#304239] sm:flex-row sm:items-baseline sm:justify-between";
        return onOpenMovement ? (
          <Button
            className={className}
            key={movement.id}
            onPress={() => onOpenMovement(movement.id)}
            variant="ghost"
          >
            {content}
          </Button>
        ) : (
          <View className={className} key={movement.id}>
            {content}
          </View>
        );
      })}
    </View>
  );
}
