import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

/**
 * One line of table text that truncates. A table cell sizes itself to its content, so text only
 * truncates inside a container with a bounded width.
 */
export function CellText({
  children,
  className,
  maxWidth,
}: {
  children: string;
  className?: string;
  /** A Tailwind max-width class such as `max-w-[12rem]`. */
  maxWidth: string;
}) {
  return (
    <View className={cn("min-w-0", maxWidth)}>
      <Text className={cn("text-[13px]", className)} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}
