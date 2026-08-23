import { describe, expect, test } from "bun:test";

import {
  getCurrencyMinorUnitDigits,
  isSupportedCurrency,
  isSupportedTimeZone,
  ProductError,
  resolveLocalDateTime,
} from "../src/product.ts";

describe("product domain primitives", () => {
  test("validates configured currency and time-zone identifiers", () => {
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(getCurrencyMinorUnitDigits("USD")).toBe(2);
    expect(isSupportedCurrency("ZZZ")).toBe(false);
    expect(isSupportedTimeZone("America/El_Salvador")).toBe(true);
    expect(isSupportedTimeZone("US/Central")).toBe(true);
    expect(isSupportedTimeZone("Mars/Olympus_Mons")).toBe(false);
  });

  test("resolves an ordinary business-local minute to a unique instant", () => {
    expect(
      resolveLocalDateTime({
        date: "2026-08-22",
        time: "14:30",
        timeZone: "America/El_Salvador",
      }).toISOString(),
    ).toBe("2026-08-22T20:30:00.000Z");
  });

  test("rejects nonexistent and ambiguous daylight-saving minutes", () => {
    expect(() =>
      resolveLocalDateTime({
        date: "2026-03-08",
        time: "02:30",
        timeZone: "America/New_York",
      }),
    ).toThrow(ProductError);
    expect(() =>
      resolveLocalDateTime({
        date: "2026-11-01",
        time: "01:30",
        timeZone: "America/New_York",
      }),
    ).toThrow("ambiguous");
  });

  test("classifies daylight-saving gaps and overlaps across hemispheres and sub-hour offsets", () => {
    const nonexistent = [
      { date: "2026-03-08", time: "02:30", timeZone: "America/New_York" },
      { date: "2026-10-04", time: "02:30", timeZone: "Australia/Sydney" },
      { date: "2026-03-29", time: "01:30", timeZone: "Europe/London" },
    ];
    for (const input of nonexistent) {
      expect(() => resolveLocalDateTime(input)).toThrow("does not exist");
    }

    const ambiguous = [
      { date: "2026-11-01", time: "01:30", timeZone: "America/New_York" },
      { date: "2026-04-05", time: "02:30", timeZone: "Australia/Sydney" },
      { date: "2026-04-05", time: "03:15", timeZone: "Pacific/Chatham" },
    ];
    for (const input of ambiguous) {
      expect(() => resolveLocalDateTime(input)).toThrow("ambiguous");
    }
  });

  test("resolves minutes in a zone whose offset is not a whole hour", () => {
    expect(
      resolveLocalDateTime({
        date: "2026-09-27",
        time: "02:15",
        timeZone: "Pacific/Chatham",
      }).toISOString(),
    ).toBe("2026-09-26T13:30:00.000Z");
  });

  test("rejects a calendar date that does not exist", () => {
    expect(() =>
      resolveLocalDateTime({
        date: "2026-02-30",
        time: "10:00",
        timeZone: "America/El_Salvador",
      }),
    ).toThrow(ProductError);
  });
});
