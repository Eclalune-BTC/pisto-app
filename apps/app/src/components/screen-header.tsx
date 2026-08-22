import type { ReactNode } from "react";
import { Text, View } from "react-native";

type ScreenHeaderProps = {
  action?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
};

export function ScreenHeader({ action, description, eyebrow, title }: ScreenHeaderProps) {
  return (
    <View className="gap-4 sm:flex-row sm:items-end sm:justify-between">
      <View className="max-w-[680px] gap-2">
        {eyebrow ? (
          <Text className="text-sm font-bold text-positive dark:text-[#8DDEAF]">{eyebrow}</Text>
        ) : null}
        <Text className="text-[32px] font-black leading-[38px] tracking-[-1.4px] text-ink dark:text-white sm:text-[40px] sm:leading-[46px]">
          {title}
        </Text>
        <Text className="text-base leading-6 text-ink-muted dark:text-[#AAB8B0]">
          {description}
        </Text>
      </View>
      {action}
    </View>
  );
}
