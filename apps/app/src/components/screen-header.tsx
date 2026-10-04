import type { ReactNode } from "react";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

type ScreenHeaderProps = {
  action?: ReactNode;
  description?: string;
  eyebrow?: string;
  title: string;
};

export function ScreenHeader({ action, description, eyebrow, title }: ScreenHeaderProps) {
  return (
    <View className="gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <View className="min-w-0 max-w-[680px] gap-2 sm:basis-[340px] sm:grow sm:shrink">
        {eyebrow ? <Text className="font-ui text-xs text-primary">{eyebrow}</Text> : null}
        <Heading>{title}</Heading>
        {description ? (
          <Text className="max-w-[600px] text-sm leading-6 text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </View>
      {action ? <View className="max-w-full shrink gap-3">{action}</View> : null}
    </View>
  );
}
