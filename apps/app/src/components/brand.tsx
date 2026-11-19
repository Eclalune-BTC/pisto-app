import { useTranslation } from "react-i18next";
import { View } from "react-native";
import Svg, { G, Path, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { Text } from "@/components/ui/text";

import { cn } from "@/lib/cn";
import mark from "../../assets/brand/mark.json";

type BrandProps = {
  compact?: boolean;
  /** On the forest-green brand panel: the tile turns lime and the wordmark light. */
  inverse?: boolean;
};

/**
 * Pisto's mark on its tile, beside the wordmark: a lime ring standing on one leg, which reads as
 * a "p" and as a coin, on forest green. The tile keeps its two colours in both themes.
 */
export function Brand({ compact = false, inverse = false }: BrandProps) {
  const { t } = useTranslation();
  const [tile, glyph] = useCSSVariable(["--color-brand", "--color-brand-foreground"]) as [
    string,
    string,
  ];
  const size = compact ? 28 : 26;

  return (
    <View
      accessible
      accessibilityLabel={t("common.appName")}
      className="flex-row items-center gap-2"
    >
      <Svg aria-hidden height={size} viewBox={mark.viewBox} width={size}>
        <Rect fill={inverse ? glyph : tile} height={64} rx={mark.radius} width={64} />
        <G transform="translate(32 32) scale(0.64) translate(-32 -32)">
          <Path d={mark.path} fill={inverse ? tile : glyph} fillRule="evenodd" />
        </G>
      </Svg>
      {!compact ? (
        <Text
          className={cn(
            "font-heading text-title-lg tracking-[-0.7px]",
            inverse ? "text-primary-foreground" : "text-foreground",
          )}
        >
          pisto
        </Text>
      ) : null}
    </View>
  );
}
