import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Heading } from "@/components/ui/heading";

type ScreenHeaderProps = {
  action?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
};

export function ScreenHeader({ action, description, eyebrow, title }: ScreenHeaderProps) {
  return (
    <View className="gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <View className="min-w-0 max-w-[680px] gap-2 sm:basis-[340px] sm:grow sm:shrink">
        {eyebrow ? <Text className="text-sm text-muted-foreground">{eyebrow}</Text> : null}
        <Heading>{title}</Heading>
        <Text className="text-base leading-6 text-muted-foreground">{description}</Text>
      </View>
      {action ? <View className="max-w-full shrink gap-3">{action}</View> : null}
    </View>
  );
}
