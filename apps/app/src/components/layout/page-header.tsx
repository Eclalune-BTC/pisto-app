import type { ReactNode } from "react";
import { View } from "react-native";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";

type PageHeaderProps = {
  /** Primary and secondary actions; the primary action is the last child. */
  actions?: ReactNode;
  /** Status badges or similar context shown next to the title. */
  adornment?: ReactNode;
  description?: string;
  title: string;
};

/** The single H1 of a route. Orientation lives in the breadcrumb, so there is no eyebrow. */
export function PageHeader({ actions, adornment, description, title }: PageHeaderProps) {
  return (
    <View className="flex-row flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <View className="min-w-0 shrink grow basis-[280px] gap-1">
        <View className="min-w-0 flex-row flex-wrap items-center gap-2">
          <Heading className="shrink">{title}</Heading>
          {/* Badges align to their row's start; the wrapper is what centers on the title. */}
          {adornment ? <View>{adornment}</View> : null}
        </View>
        {description ? (
          <Text className="max-w-[640px] text-sm leading-5 text-muted-foreground">
            {description}
          </Text>
        ) : null}
      </View>
      {actions ? (
        <View className="max-w-full flex-row flex-wrap items-center gap-2">{actions}</View>
      ) : null}
    </View>
  );
}
