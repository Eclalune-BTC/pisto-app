import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const sources = import.meta.glob("../../**/*.{tsx,ts,css}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

function isBlue(hex: string): boolean {
  const values = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [red = 0, green = 0, blue = 0] = values;
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const difference = maximum - minimum;
  if (difference < 0.035 || maximum === 0 || difference / maximum < 0.12) return false;
  let hue =
    maximum === red
      ? (green - blue) / difference
      : maximum === green
        ? 2 + (blue - red) / difference
        : 4 + (red - green) / difference;
  hue = (hue * 60 + 360) % 360;
  return hue >= 175 && hue <= 280;
}

describe("owner's no-blue requirement", () => {
  test("rejects blue palette utilities and literal blues in application-owned source", () => {
    const violations: string[] = [];
    for (const [filename, source] of Object.entries(sources)) {
      if (/\.test\./.test(filename)) continue;
      if (/(?:bg|text|border|ring|fill|stroke|shadow)-(?:blue|sky|cyan|indigo)-\d/.test(source))
        violations.push(filename);
      for (const [color] of source.matchAll(/#[\da-fA-F]{6}\b/g))
        if (isBlue(color)) violations.push(`${filename}: ${color}`);
    }
    expect(violations).toEqual([]);
  });
  test("uses an explicit neutral navigation theme instead of the blue platform defaults", () => {
    const layout = readFileSync(new URL("../../app/_layout.tsx", import.meta.url), "utf8");
    expect(layout).toContain("navigationTheme.dark");
    expect(layout).toContain("navigationTheme.light");
    expect(layout).not.toContain("? DarkTheme : DefaultTheme");
  });
});
