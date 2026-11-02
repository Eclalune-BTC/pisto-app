import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useCSSVariable: () => [],
  withUniwind: (component: unknown) => component,
}));

import { splitMoney } from "./money-figure";
import { axisLabelIndexes, chartGeometry } from "./money-trend-chart";

describe("money hero figures", () => {
  test("splits the cents from the exact formatted amount", () => {
    expect(splitMoney("485730", "USD", 2, "es-SV")).toEqual({ whole: "$4,857", fraction: ".30" });
    expect(splitMoney("-1205", "USD", 2, "es-SV")).toEqual({
      whole: "−$12",
      fraction: ".05",
    });
    expect(splitMoney("9223372036854775807", "USD", 2, "es-SV").whole).toBe(
      "$92,233,720,368,547,758",
    );
    expect(splitMoney("1500", "JPY", 0, "es-SV").fraction).toBe("");
  });

  test("labels the first and last day and spreads the rest", () => {
    expect(axisLabelIndexes(3)).toEqual([0, 1, 2]);
    expect(axisLabelIndexes(30)).toEqual([0, 7, 15, 22, 29]);
  });

  test("draws a flat series in the middle and keeps every point inside the box", () => {
    const flat = chartGeometry(
      [
        { localDate: "2026-11-01", closingMinorUnits: "1000" },
        { localDate: "2026-11-02", closingMinorUnits: "1000" },
      ],
      200,
      100,
    );
    expect(flat.coordinates.map(({ y }) => Math.round(y))).toEqual([53, 53]);
    const varied = chartGeometry(
      [
        { localDate: "2026-11-01", closingMinorUnits: "-500" },
        { localDate: "2026-11-02", closingMinorUnits: "2500" },
        { localDate: "2026-11-03", closingMinorUnits: "1000" },
      ],
      200,
      100,
    );
    for (const { x, y } of varied.coordinates) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(200);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(100);
    }
    expect(varied.coordinates[1]?.y).toBeLessThan(varied.coordinates[2]?.y ?? 0);
  });
});
