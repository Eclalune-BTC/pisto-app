import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { Text } from "@/components/ui/text";

import { cn } from "@/lib/cn";
import mark from "../../assets/brand/mark.json";

type BrandProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function Brand({ compact = false, inverse = false }: BrandProps) {
  const { t } = useTranslation();
  const [primary, primaryForeground] = useCSSVariable([
    "--color-primary",
    "--color-primary-foreground",
  ]) as [string, string];

  return (
    <View
      accessible
      accessibilityLabel={t("common.appName")}
      className="flex-row items-center gap-2"
    >
      <Svg aria-hidden height={compact ? 28 : 24} viewBox={mark.viewBox} width={compact ? 28 : 24}>
        <Rect
          fill={inverse ? primaryForeground : primary}
          height={64}
          rx={mark.radius}
          width={64}
        />
        <Path d={mark.path} fill={inverse ? primary : primaryForeground} fillRule="evenodd" />
      </Svg>
      {!compact ? (
        <Text
          className={cn(
            "font-heading font-normal text-[18px] leading-6 tracking-[-0.4px]",
            inverse ? "text-primary-foreground" : "text-foreground",
          )}
        >
          pisto
        </Text>
      ) : null}
    </View>
  );
}
