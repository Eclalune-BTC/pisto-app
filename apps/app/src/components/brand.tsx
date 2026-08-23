import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { cn } from "@/lib/cn";

type BrandProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function Brand({ compact = false, inverse = false }: BrandProps) {
  const { t } = useTranslation();

  return (
    <View accessibilityLabel={t("common.appName")} className="flex-row items-center gap-3">
      <View className="h-10 w-10 items-center justify-center rounded-full bg-accent">
        <Text className="text-xl font-black text-ink">P</Text>
      </View>
      {!compact ? (
        <Text
          className={cn(
            "text-xl font-black tracking-[-0.8px]",
            inverse ? "text-white" : "text-ink dark:text-white",
          )}
        >
          pisto
        </Text>
      ) : null}
    </View>
  );
}
