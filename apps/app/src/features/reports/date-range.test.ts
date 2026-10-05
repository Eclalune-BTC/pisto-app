import { afterEach, describe, expect, test, vi } from "vitest";

import {
  businessPresetRanges,
  currentBusinessMonthRange,
  matchingPreset,
  parseReportRangeParams,
  presetRange,
  reportRangeParams,
  validateReportRange,
} from "./date-range";

afterEach(() => {
  vi.useRealTimers();
});

describe("operating report range", () => {
  test("defaults to the month to date in the business time zone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T04:30:00.000Z"));

    expect(currentBusinessMonthRange("America/El_Salvador")).toEqual({
      startLocalDate: "2026-02-01",
      endLocalDate: "2026-02-28",
    });
    expect(currentBusinessMonthRange("UTC")).toEqual({
      startLocalDate: "2026-03-01",
      endLocalDate: "2026-03-01",
    });
  });

  test("computes every preset from today in the business time zone, not the device's", () => {
    vi.useFakeTimers();
    // Already March 1 in UTC, still February 28 in San Salvador.
    vi.setSystemTime(new Date("2026-03-01T04:30:00.000Z"));

    expect(businessPresetRanges("America/El_Salvador")).toEqual({
      thisMonth: { startLocalDate: "2026-02-01", endLocalDate: "2026-02-28" },
      lastMonth: { startLocalDate: "2026-01-01", endLocalDate: "2026-01-31" },
      last30Days: { startLocalDate: "2026-01-30", endLocalDate: "2026-02-28" },
    });
    expect(businessPresetRanges("UTC")).toEqual({
      thisMonth: { startLocalDate: "2026-03-01", endLocalDate: "2026-03-01" },
      lastMonth: { startLocalDate: "2026-02-01", endLocalDate: "2026-02-28" },
      last30Days: { startLocalDate: "2026-01-31", endLocalDate: "2026-03-01" },
    });
  });

  test("crosses year and leap-month boundaries with whole calendar days", () => {
    expect(presetRange("lastMonth", "2026-01-15")).toEqual({
      startLocalDate: "2025-12-01",
      endLocalDate: "2025-12-31",
    });
    expect(presetRange("lastMonth", "2024-03-31")).toEqual({
      startLocalDate: "2024-02-01",
      endLocalDate: "2024-02-29",
    });
    expect(presetRange("last30Days", "2024-03-01")).toEqual({
      startLocalDate: "2024-02-01",
      endLocalDate: "2024-03-01",
    });
    // A daylight-saving change in the device zone cannot skip or repeat a day.
    expect(presetRange("last30Days", "2026-11-15")).toEqual({
      startLocalDate: "2026-10-17",
      endLocalDate: "2026-11-15",
    });
  });

  test("names the preset the shown dates match and nothing for typed dates", () => {
    const presets = {
      thisMonth: presetRange("thisMonth", "2026-10-04"),
      lastMonth: presetRange("lastMonth", "2026-10-04"),
      last30Days: presetRange("last30Days", "2026-10-04"),
    };
    expect(
      matchingPreset({ startLocalDate: "2026-09-01", endLocalDate: "2026-09-30" }, presets),
    ).toBe("lastMonth");
    expect(
      matchingPreset({ startLocalDate: "2026-09-05", endLocalDate: "2026-10-04" }, presets),
    ).toBe("last30Days");
    expect(
      matchingPreset({ startLocalDate: "2026-09-02", endLocalDate: "2026-09-30" }, presets),
    ).toBe("custom");
  });

  test("accepts a range the contract accepts and returns its parsed value", () => {
    expect(
      validateReportRange({ startLocalDate: "2026-03-01", endLocalDate: "2026-03-31" }),
    ).toEqual({
      valid: true,
      value: { startLocalDate: "2026-03-01", endLocalDate: "2026-03-31" },
    });
  });

  test("names the field that carries an unreal calendar date", () => {
    expect(
      validateReportRange({ startLocalDate: "2026-02-30", endLocalDate: "2026-03-01" }),
    ).toEqual({ issue: "invalid-start", valid: false });
    expect(
      validateReportRange({ startLocalDate: "2026-03-01", endLocalDate: "2025-02-29" }),
    ).toEqual({ issue: "invalid-end", valid: false });
    expect(
      validateReportRange({ startLocalDate: "03/01/2026", endLocalDate: "2026-03-31" }),
    ).toEqual({ issue: "invalid-start", valid: false });
    expect(validateReportRange({ startLocalDate: "2026-03-01", endLocalDate: "" })).toEqual({
      issue: "invalid-end",
      valid: false,
    });
  });

  test("separates a reversed range from one the contract caps for length", () => {
    expect(
      validateReportRange({ startLocalDate: "2026-03-31", endLocalDate: "2026-03-01" }),
    ).toEqual({ issue: "reversed", valid: false });
    expect(
      validateReportRange({ startLocalDate: "2025-01-01", endLocalDate: "2026-01-02" }),
    ).toEqual({ issue: "too-long", valid: false });
    expect(
      validateReportRange({ startLocalDate: "2025-01-01", endLocalDate: "2026-01-01" }).valid,
    ).toBe(true);
  });
});

describe("report range in the URL", () => {
  const thisMonth = { startLocalDate: "2026-10-01", endLocalDate: "2026-10-04" };

  test("restores only a complete range the contract accepts", () => {
    expect(parseReportRangeParams({ start: "2026-09-01", end: "2026-09-30" })).toEqual({
      startLocalDate: "2026-09-01",
      endLocalDate: "2026-09-30",
    });
    expect(
      parseReportRangeParams({ start: ["2026-09-01", "2026-01-01"], end: "2026-09-30" }),
    ).toEqual({ startLocalDate: "2026-09-01", endLocalDate: "2026-09-30" });
    for (const params of [
      {},
      { start: "2026-09-01" },
      { start: "2026-09-30", end: "2026-09-01" },
      { start: "2025-01-01", end: "2026-09-30" },
      { start: "2026-02-30", end: "2026-03-01" },
    ]) {
      expect(parseReportRangeParams(params)).toBeUndefined();
    }
  });

  test("leaves the default range out of the URL and writes any other range", () => {
    expect(reportRangeParams(thisMonth, thisMonth)).toEqual({ end: undefined, start: undefined });
    expect(
      reportRangeParams({ startLocalDate: "2026-09-01", endLocalDate: "2026-09-30" }, thisMonth),
    ).toEqual({ end: "2026-09-30", start: "2026-09-01" });
  });
});
