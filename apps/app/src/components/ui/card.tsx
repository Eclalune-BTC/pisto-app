import type { ComponentProps } from "react";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<typeof View>) {
  return (
    <View
      className={cn(
        "rounded-[24px] border border-line bg-surface p-5 dark:border-[#304239] dark:bg-[#192A23]",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn("text-lg font-bold tracking-[-0.3px] text-ink dark:text-white", className)}
      {...props}
    />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn("text-sm leading-5 text-ink-muted dark:text-[#AAB8B0]", className)}
      {...props}
    />
  );
}
