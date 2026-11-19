import type { PropsWithChildren, ReactNode } from "react";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

type SectionProps = PropsWithChildren<{
  actions?: ReactNode;
  description?: string;
  title: string;
}>;

/**
 * An H2 region of a page, ruled like a ledger: a hairline opens it, and its title, the one line
 * that qualifies it and its actions share the row under that rule.
 */
export function Section({ actions, children, description, title }: SectionProps) {
  return (
    <View
      accessibilityLabel={title}
      className="min-w-0 gap-4 border-t border-border pt-5"
      role="region"
    >
      <View className="flex-row flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <View className="min-w-0 shrink grow basis-[220px] flex-row flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <Heading level={2} size="section">
            {title}
          </Heading>
          {description ? (
            <Text className="min-w-0 shrink text-dense text-muted-foreground">{description}</Text>
          ) : null}
        </View>
        {actions ? <View className="flex-row flex-wrap items-center gap-2">{actions}</View> : null}
      </View>
      {children}
    </View>
  );
}
