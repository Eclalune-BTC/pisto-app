import { Inbox, type LucideIcon } from "lucide-react-native";
import type { ReactNode } from "react";
import { View } from "react-native";
import { Icon } from "./icon";
import { Text } from "./text";

/** Shown only after a successful read returned no records; failures use `StatePanel`. */
export function EmptyState({
  action,
  description,
  icon = Inbox,
  title,
}: {
  action?: ReactNode;
  description: string;
  icon?: LucideIcon;
  title: string;
}) {
  return (
    <View className="min-w-0 items-center gap-1.5 rounded-lg border border-dashed border-border px-6 py-10">
      <Icon as={icon} className="mb-1 text-muted-foreground" size={20} strokeWidth={1.75} />
      <Text accessibilityRole="header" aria-level={3} className="font-heading text-sm text-center">
        {title}
      </Text>
      <Text className="max-w-[420px] text-center text-sm leading-5 text-muted-foreground">
        {description}
      </Text>
      {action ? (
        <View className="mt-2 flex-row flex-wrap justify-center gap-2">{action}</View>
      ) : null}
    </View>
  );
}
