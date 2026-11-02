import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { Text } from "@/components/ui/text";

import { cn } from "@/lib/cn";
import mark from "../../assets/brand/mark.json";

type BrandProps = {
  compact?: boolean;
  /** For the dark brand panel: the wordmark turns light, the mark keeps its own colors. */
  inverse?: boolean;
};

/** The forest-green mark with the lime monogram, the same in both themes, like the prototypes. */
export function Brand({ compact = false, inverse = false }: BrandProps) {
  const { t } = useTranslation();
  const [brand, brandForeground] = useCSSVariable([
    "--color-brand",
    "--color-brand-foreground",
  ]) as [string, string];

  return (
    <View
      accessible
      accessibilityLabel={t("common.appName")}
      className="flex-row items-center gap-2"
    >
      <Svg aria-hidden height={compact ? 28 : 26} viewBox={mark.viewBox} width={compact ? 28 : 26}>
        <Rect fill={brand} height={64} rx={14} width={64} />
        <Path d={mark.path} fill={brandForeground} fillRule="evenodd" />
      </Svg>
      {!compact ? (
        <Text
          className={cn(
            "font-heading font-normal text-[19px] leading-6 tracking-[-0.5px]",
            inverse ? "text-primary-foreground" : "text-foreground",
          )}
        >
          pisto
        </Text>
      ) : null}
    </View>
  );
}
