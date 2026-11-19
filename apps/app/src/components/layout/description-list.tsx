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

/**
 * Label/value pairs with a fixed label column. `aside` is for the side column of
 * `DetailColumns`: where that column is narrow, the label takes its own width and the value ends
 * the row; where the page stacks, it reads like any other list.
 */
export function DescriptionList({
  items,
  layout = "columns",
}: {
  items: readonly DescriptionItem[];
  layout?: "columns" | "aside";
}) {
  const aside = layout === "aside";
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-card">
      {items.map((item, index) => (
        <View
          className={cn(
            "min-w-0 flex-row items-start gap-4 px-4 py-2.5 sm:items-center sm:gap-6",
            aside && "min-[1360px]:items-start min-[1360px]:justify-between min-[1360px]:gap-4",
            index > 0 && "border-t border-border",
          )}
          key={item.label}
        >
          <Text
            className={cn(
              "w-28 shrink-0 text-dense text-muted-foreground sm:w-48",
              aside && "min-[1360px]:w-auto min-[1360px]:max-w-[45%]",
            )}
          >
            {item.label}
          </Text>
          <View className={cn("min-w-0 flex-1", aside && "min-[1360px]:items-end")}>
            {typeof item.value === "string" ? (
              <Text
                className={cn(
                  "text-sm leading-5",
                  aside && "min-[1360px]:text-right",
                  item.numeric && "tabular-nums",
                )}
              >
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
