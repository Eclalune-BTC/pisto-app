import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { cn, TEXT_ROLES } from "./cn";

const css = readFileSync(new URL("../global.css", import.meta.url), "utf8");
const sources = import.meta.glob("../**/*.{tsx,ts}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

describe("type roles", () => {
  test("declares every theme font size to the class merger, and nothing else", () => {
    const declared = [...css.matchAll(/^\s*--text-([a-z]+(?:-[a-z]+)*):/gm)].map(
      ([, name]) => name,
    );
    expect([...declared].sort()).toEqual([...TEXT_ROLES].sort());
  });

  test("gives every role its own line height", () => {
    for (const role of TEXT_ROLES) expect(css).toContain(`--text-${role}--line-height:`);
  });

  test("keeps the colour beside a role and lets a later size replace an earlier one", () => {
    expect(cn("text-foreground", "text-dense")).toBe("text-foreground text-dense");
    expect(cn("text-dense text-muted-foreground", "text-display")).toBe(
      "text-muted-foreground text-display",
    );
    expect(cn("text-base", "text-micro")).toBe("text-micro");
    expect(cn("text-display-sm", "lg:text-display-lg")).toBe("text-display-sm lg:text-display-lg");
  });

  test("sizes text with a role, never a one-off pixel value", () => {
    const offenders = Object.entries(sources)
      .filter(([filename]) => !/\.test\./.test(filename))
      .filter(([, source]) => /(?<![\w-])text-\[\d+px\]/.test(source))
      .map(([filename]) => filename);
    expect(offenders).toEqual([]);
  });
});
