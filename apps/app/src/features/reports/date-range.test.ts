import { afterEach, describe, expect, test, vi } from "vitest";

import { currentBusinessMonthRange, monthRange, parseMonthParam, shiftMonth } from "./date-range";

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
});

describe("report months", () => {
  test("moves across years in both directions", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-10", -5)).toBe("2026-05");
  });

  test("covers a closed month to its last day and the current month to today", () => {
    expect(monthRange("2026-09", "2026-11-02")).toEqual({
      startLocalDate: "2026-09-01",
      endLocalDate: "2026-09-30",
    });
    expect(monthRange("2028-02", "2028-03-10")).toEqual({
      startLocalDate: "2028-02-01",
      endLocalDate: "2028-02-29",
    });
    expect(monthRange("2026-11", "2026-11-02")).toEqual({
      startLocalDate: "2026-11-01",
      endLocalDate: "2026-11-02",
    });
  });

  test("falls back to the current month for a malformed or future month", () => {
    expect(parseMonthParam("2026-09", "2026-11")).toBe("2026-09");
    expect(parseMonthParam(["2026-08", "2026-09"], "2026-11")).toBe("2026-08");
    expect(parseMonthParam("2026-12", "2026-11")).toBe("2026-11");
    expect(parseMonthParam("2026-13", "2026-11")).toBe("2026-11");
    expect(parseMonthParam(undefined, "2026-11")).toBe("2026-11");
  });
});
