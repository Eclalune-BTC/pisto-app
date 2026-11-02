import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync(new URL("../../global.css", import.meta.url), "utf8");
function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}
function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe("semantic normal-text color pairs", () => {
  for (const theme of ["light", "dark"]) {
    test(`${theme} keeps input, status and action text above 4.5:1`, () => {
      const block = css.match(new RegExp(`@variant ${theme} \\{([^}]+)\\}`))?.[1];
      if (!block) throw new Error(`Missing ${theme} theme.`);
      const tokens = Object.fromEntries(
        [...block.matchAll(/--color-([a-z-]+):\s*(#[a-f\d]{6})/gi)].map((match) => [
          match[1],
          match[2],
        ]),
      );
      for (const [foreground, background] of [
        ["foreground", "background"],
        ["muted-foreground", "card"],
        ["positive-foreground", "background"],
        ["positive-foreground", "positive-surface"],
        ["warning-foreground", "warning-surface"],
        ["destructive", "destructive-surface"],
        ["primary-foreground", "primary"],
        ["destructive-action-foreground", "destructive-action"],
        ["secondary-foreground", "secondary"],
        ["accent-foreground", "accent"],
        ["muted-foreground", "background"],
        ["sidebar-foreground", "sidebar"],
        ["sidebar-accent-foreground", "sidebar-accent"],
        ["popover-foreground", "popover"],
        ["highlight-foreground", "highlight"],
        ["highlight-foreground", "highlight-strong"],
      ] as const) {
        const front = tokens[foreground];
        const back = tokens[background];
        if (!front || !back) throw new Error(`Missing pair ${foreground}/${background}.`);
        expect(
          contrast(front, back),
          `${theme}: ${foreground}/${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
      for (const surface of ["background", "card", "popover"]) {
        const input = tokens.input;
        const ring = tokens.ring;
        const background = tokens[surface];
        if (!input || !ring || !background)
          throw new Error(`Missing control tokens for ${surface}.`);
        expect(contrast(input, background), `${theme}: input/${surface}`).toBeGreaterThanOrEqual(3);
        expect(contrast(ring, background), `${theme}: ring/${surface}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
