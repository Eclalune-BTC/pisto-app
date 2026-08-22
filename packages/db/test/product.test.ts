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
});
