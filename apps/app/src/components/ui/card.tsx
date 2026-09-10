import type { ComponentProps } from "react";
import { Text, View } from "react-native";

import { Heading } from "@/components/ui/heading";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<typeof View>) {
  return (
    <View className={cn("rounded-xl border border-border bg-card p-6", className)} {...props} />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<typeof Text>) {
  return <Heading {...props} className={className} level={2} size="section" />;
}

export function CardDescription({ className, ...props }: ComponentProps<typeof Text>) {
  return <Text className={cn("text-sm leading-5 text-muted-foreground", className)} {...props} />;
}
