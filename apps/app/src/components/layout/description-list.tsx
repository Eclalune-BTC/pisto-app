import type { ReactNode } from "react";
import { View } from "react-native";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

export type DescriptionItem = {
  label: string;
  /** Plain text, or a composed value such as a badge or link. */
  value: ReactNode;
  /** Money, quantities and dates align as tabular figures. */
  numeric?: boolean;
};

/** Label/value pairs: two columns on wide screens, stacked on phones. */
export function DescriptionList({ items }: { items: readonly DescriptionItem[] }) {
  return (
    <View className="overflow-hidden rounded-lg border border-border bg-card">
      {items.map((item, index) => (
        <View
          className={cn(
            "min-w-0 gap-0.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-6",
            index > 0 && "border-t border-border",
          )}
          key={item.label}
        >
          <Text className="text-[13px] leading-5 text-muted-foreground sm:w-48 sm:shrink-0">
            {item.label}
          </Text>
          <View className="min-w-0 flex-1">
            {typeof item.value === "string" ? (
              <Text className={cn("text-sm leading-5", item.numeric && "tabular-nums")}>
                {item.value}
              </Text>
            ) : (
              item.value
            )}
          </View>
        </View>
      ))}
    </View>
  );
}
