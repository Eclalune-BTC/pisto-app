import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

const alertVariants = cva("rounded-lg border p-4", {
  variants: {
    tone: {
      danger: "border-destructive bg-destructive-surface",
      warning: "border-warning bg-warning-surface",
    },
  },
  defaultVariants: { tone: "warning" },
});

export function Alert({
  children,
  tone = "warning",
}: VariantProps<typeof alertVariants> & { children: ReactNode }) {
  return (
    <View className={alertVariants({ tone })}>
      <Text
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        className={cn(
          "text-sm leading-5",
          tone === "danger" ? "text-destructive" : "text-warning-foreground",
        )}
      >
        {children}
      </Text>
    </View>
  );
}
