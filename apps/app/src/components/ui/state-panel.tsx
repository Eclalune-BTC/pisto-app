import type { LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { Text } from "./text";

/**
 * Denied, offline and failed reads. Keeps the route's heading level so a full-page state is the
 * page's H1 and an inline state stays under its section.
 */
export function StatePanel({
  action,
  description,
  icon,
  level,
  title,
  tone = "default",
}: {
  action?: ReactNode;
  description: string;
  icon: LucideIcon;
  level: 1 | 2 | 3;
  title: string;
  tone?: "default" | "destructive";
}) {
  return (
    <View className="min-w-0 items-start gap-1.5 rounded-lg border border-border bg-card px-5 py-6">
      <Icon
        as={icon}
        className={cn(
          "mb-1",
          tone === "destructive" ? "text-destructive" : "text-muted-foreground",
        )}
        size={20}
        strokeWidth={1.75}
      />
      <Text accessibilityRole="header" aria-level={level} className="font-heading text-sm">
        {title}
      </Text>
      <Text className="max-w-[560px] text-sm leading-5 text-muted-foreground">{description}</Text>
      {action ? <View className="mt-2 flex-row flex-wrap gap-2">{action}</View> : null}
    </View>
  );
}
