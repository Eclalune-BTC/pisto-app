import type { CashFlowReport } from "@pisto/contracts";
import { useState } from "react";
import { View } from "react-native";
import Svg, { G, Line, Rect } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { Text } from "@/components/ui/text";
import { formatMonthName } from "@/i18n/format";
import { barHeights } from "./report-figures";

type CashFlowMonth = CashFlowReport["months"][number];

const CHART_HEIGHT = 144;
const BAR_WIDTH = 14;
const BAR_GAP = 3;

/**
 * Inflow beside outflow for each month. The bars are decoration for sighted readers; the table
 * under the chart carries the exact figures, so the drawing is hidden from assistive technology.
 */
export function CashFlowChart({ locale, months }: { locale: string; months: CashFlowMonth[] }) {
  const [width, setWidth] = useState(0);
  const [primary, mutedForeground, border] = useCSSVariable([
    "--color-primary",
    "--color-muted-foreground",
    "--color-border",
  ]) as [string, string, string];
  const heights = barHeights(months, CHART_HEIGHT);
  const slot = width / Math.max(months.length, 1);
  return (
    <View
      aria-hidden
      className="min-w-0"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg height={CHART_HEIGHT + 1} width={width}>
          {[0, 0.5].map((fraction) => (
            <Line
              key={fraction}
              stroke={border}
              strokeDasharray="3 4"
              strokeWidth={1}
              x1={0}
              x2={width}
              y1={CHART_HEIGHT * fraction + 0.5}
              y2={CHART_HEIGHT * fraction + 0.5}
            />
          ))}
          <Line
            stroke={border}
            strokeWidth={1}
            x1={0}
            x2={width}
            y1={CHART_HEIGHT + 0.5}
            y2={CHART_HEIGHT + 0.5}
          />
          {months.map((month, index) => {
            const center = slot * index + slot / 2;
            const bars = heights[index];
            if (!bars) return null;
            return (
              <G key={month.month}>
                <Rect
                  fill={primary}
                  height={bars.inflow}
                  rx={2}
                  width={BAR_WIDTH}
                  x={center - BAR_WIDTH - BAR_GAP / 2}
                  y={CHART_HEIGHT - bars.inflow}
                />
                <Rect
                  fill={mutedForeground}
                  fillOpacity={0.35}
                  height={bars.outflow}
                  rx={2}
                  width={BAR_WIDTH}
                  x={center + BAR_GAP / 2}
                  y={CHART_HEIGHT - bars.outflow}
                />
              </G>
            );
          })}
        </Svg>
      ) : (
        <View style={{ height: CHART_HEIGHT + 1 }} />
      )}
      <View className="mt-1.5 flex-row">
        {months.map((month) => (
          <Text
            className="flex-1 text-center text-xs capitalize text-muted-foreground"
            key={month.month}
          >
            {formatMonthName(`${month.month}-01`, locale, "short")}
          </Text>
        ))}
      </View>
    </View>
  );
}
