import type { PropsWithChildren } from "react";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

type FormSectionProps = PropsWithChildren<{ description?: string; title: string }>;

/**
 * A titled group of fields. On wide screens the title sits beside its fields, so a group title
 * never reads as one more field label.
 */
export function FormSection({ children, description, title }: FormSectionProps) {
  return (
    <View accessibilityLabel={title} className="min-w-0 gap-3 sm:flex-row sm:gap-8" role="region">
      <View className="min-w-0 gap-1 sm:w-44 sm:shrink-0">
        <Heading level={2} size="section">
          {title}
        </Heading>
        {description ? (
          <Text className="text-[13px] leading-5 text-muted-foreground">{description}</Text>
        ) : null}
      </View>
      <View className="min-w-0 flex-1 gap-4">{children}</View>
    </View>
  );
}
