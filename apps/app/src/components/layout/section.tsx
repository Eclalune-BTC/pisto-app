import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

type SectionProps = PropsWithChildren<{
  actions?: ReactNode;
  description?: string;
  title: string;
}>;

/** An H2 region of a page. Grouping comes from spacing and the heading, not from a border. */
export function Section({ actions, children, description, title }: SectionProps) {
  return (
    <View accessibilityLabel={title} className="min-w-0 gap-3" role="region">
      <View className="flex-row flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <View className="min-w-0 shrink grow basis-[220px] gap-0.5">
          <Heading level={2} size="section">
            {title}
          </Heading>
          {description ? (
            <Text className="text-[13px] leading-5 text-muted-foreground">{description}</Text>
          ) : null}
        </View>
        {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
      </View>
      {children}
    </View>
  );
}
