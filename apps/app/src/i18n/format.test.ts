import { describe, expect, test } from "vitest";
import {
  formatLocalDate,
  formatLocalizedDate,
  formatLocalizedDateTime,
  formatLocalMoment,
} from "./format";

const featureSources = import.meta.glob("../features/**/*.{ts,tsx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

describe("date and time formatting", () => {
  test("shows a typed draft, its review and the stored record as the same moment", () => {
    expect(formatLocalMoment("2026-10-04", "17:07", "es-SV")).toBe("4 oct 2026, 17:07");
    expect(
      formatLocalizedDateTime("2026-10-04T23:07:00.000Z", "es-SV", "America/El_Salvador"),
    ).toBe("4 oct 2026, 17:07");
  });

  test("spells the month so a date cannot be read in the wrong order", () => {
    expect(formatLocalDate("2026-04-10", "es-SV")).toBe("10 abr 2026");
    expect(formatLocalizedDate("2026-04-10T12:00:00.000Z", "es-SV", "UTC")).toBe("10 abr 2026");
  });

  test("rejects an impossible local moment instead of rolling it over", () => {
    expect(() => formatLocalMoment("2026-02-30", "10:00", "es-SV")).toThrow();
    expect(() => formatLocalMoment("2026-02-10", "24:00", "es-SV")).toThrow();
  });

  test("keeps feature code on the shared formatter", () => {
    const local = Object.entries(featureSources)
      .filter(([path]) => !/\.test\./.test(path))
      .filter(([, source]) =>
        /new Intl\.DateTimeFormat\([^)]*\{[^}]*(?:dateStyle|timeStyle|hour|month|day)/s.test(
          source,
        ),
      )
      .map(([path]) => path);
    expect(local).toEqual([]);
  });
});
