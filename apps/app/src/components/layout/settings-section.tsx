import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

/** Account pages: the section's title and purpose on the left, its controls on the right. */
export function SettingsSection({
  children,
  description,
  title,
}: PropsWithChildren<{ description: string; title: string }>) {
  return (
    <View accessibilityLabel={title} className="min-w-0 gap-3 lg:flex-row lg:gap-10" role="region">
      <View className="min-w-0 gap-0.5 lg:w-64 lg:shrink-0">
        <Heading level={2} size="section">
          {title}
        </Heading>
        <Text className="text-[13px] leading-5 text-muted-foreground">{description}</Text>
      </View>
      <View className="min-w-0 flex-1 gap-3 lg:max-w-2xl">{children}</View>
    </View>
  );
}
