import type { ComponentProps } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

type BadgeTone = "neutral" | "positive" | "warning";

const toneClasses: Record<BadgeTone, { container: string; text: string }> = {
  neutral: {
    container: "bg-[#EDF1ED] dark:bg-[#26372F]",
    text: "text-ink-muted dark:text-[#C3CDC7]",
  },
  positive: {
    container: "bg-[#DCF4E6] dark:bg-[#214533]",
    text: "text-positive dark:text-[#8DDEAF]",
  },
  warning: {
    container: "bg-[#FFF0DA] dark:bg-[#4A3320]",
    text: "text-warning dark:text-[#F6BB76]",
  },
};

export function Badge({
  children,
  className,
  tone = "neutral",
}: ComponentProps<typeof View> & { tone?: BadgeTone }) {
  return (
    <View
      className={cn("self-start rounded-full px-3 py-1.5", toneClasses[tone].container, className)}
    >
      <Text className={cn("text-xs font-bold", toneClasses[tone].text)}>{children}</Text>
    </View>
  );
}
