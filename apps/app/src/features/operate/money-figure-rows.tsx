import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type MoneyFigureRow = { key: string; label: string; value: string };

/**
 * The second column of the wide "Dinero disponible" card: where the money is, one account kind per
 * cell. The cells share the height the balance and its chart give the card, so the column never
 * ends in a blank.
 */
export function MoneyFigureRows({ figures }: { figures: MoneyFigureRow[] }) {
  return (
    <View className="flex-1">
      {figures.map((figure) => (
        <View
          className="min-h-14 flex-1 justify-center gap-0.5 border-t border-border py-2.5"
          key={figure.key}
        >
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {figure.label}
          </Text>
          <Text className="font-heading text-title-lg tabular-nums">{figure.value}</Text>
        </View>
      ))}
    </View>
  );
}

/** The phone card's closing strip: the same figures side by side on the lime surface. */
export function MoneyFigureStrip({ figures }: { figures: MoneyFigureRow[] }) {
  return (
    <View className="flex-row flex-wrap gap-y-3 border-t border-highlight-foreground/15 pt-3">
      {figures.map((figure, index) => (
        <View
          className={cn(
            "min-w-[120px] flex-1 gap-0.5 pr-3",
            index > 0 && "border-l border-highlight-foreground/15 pl-4",
          )}
          key={figure.key}
        >
          <Text className="text-xs text-highlight-foreground/70">{figure.label}</Text>
          <Text className="font-heading text-lg leading-6 tabular-nums text-highlight-foreground">
            {figure.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
