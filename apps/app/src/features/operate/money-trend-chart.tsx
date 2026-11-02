import type { MoneyTrend } from "@pisto/contracts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type GestureResponderEvent, Platform, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useCSSVariable } from "uniwind";
import { Text } from "@/components/ui/text";
import { formatLocalDate, formatLocalDayMonth } from "@/i18n/format";
import { cn } from "@/lib/cn";
import { formatMinorUnits } from "@/lib/money";

type Point = MoneyTrend["points"][number];

const PADDING_TOP = 10;
const PADDING_BOTTOM = 4;
const AXIS_LABELS = 5;

/**
 * Chart geometry only: amounts become pixel heights through Number, which is safe because a
 * rounding error of a cent moves a point by far less than a pixel. Labels always use the exact
 * server strings. The scale follows the range of the data, like a balance chart, and a flat
 * series sits in the middle.
 */
export function chartGeometry(points: readonly Point[], width: number, height: number) {
  const values = points.map((point) => Number(point.closingMinorUnits));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const margin = high > low ? (high - low) * 0.12 : Math.max(Math.abs(high), 1);
  const minimum = low - margin;
  const span = high + margin - minimum;
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const usable = height - PADDING_TOP - PADDING_BOTTOM;
  const coordinates = values.map((value, index) => ({
    x: points.length > 1 ? index * step : width / 2,
    y: PADDING_TOP + usable - ((value - minimum) / span) * usable,
  }));
  const line = coordinates
    .map(({ x, y }, index) => `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(" ");
  const baseline = height;
  const first = coordinates[0];
  const last = coordinates.at(-1);
  const area =
    first && last
      ? `${line} L${last.x.toFixed(2)} ${baseline.toFixed(2)} L${first.x.toFixed(2)} ${baseline.toFixed(2)} Z`
      : "";
  return { area, coordinates, line, step };
}

/** Evenly spread label positions, always including the first and last day. */
export function axisLabelIndexes(count: number, labels = AXIS_LABELS): number[] {
  if (count <= labels) return Array.from({ length: count }, (_, index) => index);
  return Array.from({ length: labels }, (_, index) =>
    Math.round((index * (count - 1)) / (labels - 1)),
  );
}

export function MoneyTrendChart({
  height,
  locale,
  tone = "card",
  trend,
}: {
  height: number;
  locale: string;
  /** `card` draws lime on a white card; `highlight` draws on the lime hero card. */
  tone?: "card" | "highlight";
  trend: MoneyTrend;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [primary, chartFill, highlightStrong, border] = useCSSVariable([
    "--color-primary",
    "--color-chart-fill",
    "--color-highlight-strong",
    "--color-border",
  ]) as [string, string, string, string];
  const points = trend.points;
  const money = (minorUnits: string) =>
    formatMinorUnits(minorUnits, trend.currency, trend.currencyMinorUnitDigits, locale);
  const geometry = width > 0 ? chartGeometry(points, width, height) : null;
  const lastIndex = points.length - 1;
  const shown = active ?? lastIndex;
  const shownPoint = points[shown];
  const shownCoordinate = geometry?.coordinates[shown];

  const pick = (x: number) => {
    if (!geometry || points.length === 0) return;
    const index = geometry.step > 0 ? Math.round(x / geometry.step) : 0;
    setActive(Math.min(lastIndex, Math.max(0, index)));
  };
  const fromEvent = (event: GestureResponderEvent) => pick(event.nativeEvent.locationX);

  return (
    <View className="gap-2">
      <View
        accessibilityLabel={t("operate.home.money.chartLabel")}
        className="relative"
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        style={{ height }}
      >
        {geometry ? (
          <Svg aria-hidden height={height} width={width}>
            {[0.25, 0.5, 0.75].map((fraction) => (
              <Line
                key={fraction}
                stroke={tone === "card" ? border : primary}
                strokeDasharray="2 4"
                strokeOpacity={tone === "card" ? 1 : 0.18}
                strokeWidth={1}
                x1={0}
                x2={width}
                y1={height * fraction}
                y2={height * fraction}
              />
            ))}
            <Path d={geometry.area} fill={tone === "card" ? chartFill : highlightStrong} />
            <Path
              d={geometry.line}
              fill="none"
              stroke={primary}
              strokeLinejoin="round"
              strokeWidth={2}
            />
            {shownCoordinate ? (
              <>
                {active !== null ? (
                  <Line
                    stroke={primary}
                    strokeOpacity={0.35}
                    strokeWidth={1}
                    x1={shownCoordinate.x}
                    x2={shownCoordinate.x}
                    y1={0}
                    y2={height}
                  />
                ) : null}
                <Circle cx={shownCoordinate.x} cy={shownCoordinate.y} fill={primary} r={4} />
              </>
            ) : null}
          </Svg>
        ) : null}
        {/* Touch and pointer both pick the nearest day; leaving resets to today. */}
        <View
          aria-hidden
          className="absolute inset-0"
          onMoveShouldSetResponder={() => true}
          onResponderGrant={fromEvent}
          onResponderMove={fromEvent}
          onResponderRelease={() => setActive(null)}
          onStartShouldSetResponder={() => true}
          {...(Platform.OS === "web"
            ? {
                onPointerLeave: () => setActive(null),
                onPointerMove: (event: { nativeEvent: { offsetX?: number } }) =>
                  pick(event.nativeEvent.offsetX ?? 0),
              }
            : {})}
        />
        {active !== null && shownPoint && shownCoordinate ? (
          <View
            aria-hidden
            className="absolute top-0 rounded-md border border-border bg-popover px-2 py-1"
            style={{
              left: Math.min(Math.max(shownCoordinate.x - 70, 0), Math.max(width - 140, 0)),
              width: 140,
            }}
          >
            <Text className="text-[11px] leading-4 text-muted-foreground">
              {formatLocalDate(shownPoint.localDate, locale)}
            </Text>
            <Text className="font-ui text-[13px] leading-4 tabular-nums">
              {money(shownPoint.closingMinorUnits)}
            </Text>
          </View>
        ) : null}
      </View>
      <View aria-hidden className="h-4 flex-row justify-between">
        {axisLabelIndexes(points.length).map((index) => {
          const point = points[index];
          if (!point) return null;
          return (
            <Text
              className={cn(
                "text-[11px] leading-4 tabular-nums",
                index === lastIndex
                  ? "font-ui text-foreground"
                  : tone === "card"
                    ? "text-muted-foreground"
                    : "text-highlight-foreground/70",
              )}
              key={point.localDate}
            >
              {index === lastIndex
                ? t("operate.home.money.today")
                : formatLocalDayMonth(point.localDate, locale)}
            </Text>
          );
        })}
      </View>
      {/* The exact figures behind the drawing, for screen readers. */}
      <View accessibilityLabel={t("operate.home.money.chartLabel")} className="sr-only" role="list">
        {points.map((point) => (
          <Text key={point.localDate} role="listitem">
            {t("operate.home.money.point", {
              date: formatLocalDate(point.localDate, locale),
              amount: money(point.closingMinorUnits),
            })}
          </Text>
        ))}
      </View>
    </View>
  );
}
