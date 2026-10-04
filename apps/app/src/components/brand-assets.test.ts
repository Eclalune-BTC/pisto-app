import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, test } from "vitest";

import config from "../../app.json";
import mark from "../../assets/brand/mark.json";

const asset = (name: string) =>
  fileURLToPath(new URL(`../../assets/brand/${name}`, import.meta.url));

describe("shared brand asset contract", () => {
  test("exports the same monogram geometry, not a platform font drawing", async () => {
    const svg = await readFile(asset("mark.svg"), "utf8");
    expect(svg).toContain(mark.path);
    expect(svg).toContain(mark.ink);
    expect(svg).toContain(`rx="${mark.radius}"`);
    expect(svg).not.toContain("<text");
    const favicon = await sharp(asset("favicon.png")).metadata();
    expect([favicon.width, favicon.height, favicon.hasAlpha]).toEqual([64, 64, true]);
  });

  test("keeps the app icon opaque and the monochrome counter transparent", async () => {
    const icon = await sharp(asset("icon.png")).metadata();
    expect([icon.width, icon.height, icon.hasAlpha]).toEqual([1024, 1024, false]);
    const { data, info } = await sharp(asset("monochrome.png"))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([1024, 1024, 4]);
    expect(data[3]).toBe(0);
    expect(data[(512 * info.width + 512) * 4 + 3]).toBe(0);
    expect(data[(512 * info.width + 380) * 4 + 3]).toBe(255);
  });

  test("configures a distinct dark splash instead of hiding a dark mark on a dark surface", async () => {
    const splash = config.expo.plugins.find(
      (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
    );
    expect(splash).toBeDefined();
    expect(JSON.stringify(splash)).toContain("splash-icon-dark.png");
    for (const name of [
      "adaptive-foreground.png",
      "adaptive-background.png",
      "splash-icon.png",
      "splash-icon-dark.png",
    ]) {
      const metadata = await sharp(asset(name)).metadata();
      expect(metadata.width).toBe(name.startsWith("adaptive") ? 1024 : 512);
    }
  });
});
