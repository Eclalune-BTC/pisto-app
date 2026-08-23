import { afterEach, describe, expect, test, vi } from "vitest";

import { currentBusinessMonthRange, validateReportRange } from "./date-range";

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
