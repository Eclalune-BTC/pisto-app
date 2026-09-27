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
      <View className="h-9 w-9 items-center justify-center rounded-lg bg-accent">
        <Text className="web:font-sans text-xl font-semibold text-ink">P</Text>
      </View>
      {!compact ? (
        <Text
          className={cn(
            "web:font-sans text-2xl font-semibold tracking-[-0.6px]",
            inverse ? "text-white" : "text-foreground",
          )}
        >
          pisto
        </Text>
      ) : null}
    </View>
  );
}
