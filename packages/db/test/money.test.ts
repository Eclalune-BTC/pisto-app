import { describe, expect, test } from "bun:test";

import { ProductError } from "../src/errors.ts";
import { parseMinorUnits } from "../src/money.ts";

describe("minor-unit parsing", () => {
  test("parses exact positive int64 minor units", () => {
    expect(parseMinorUnits("1", "Amount", { allowZero: false })).toBe(1n);
    expect(parseMinorUnits("9223372036854775807", "Amount", { allowZero: false })).toBe(
      9_223_372_036_854_775_807n,
    );
    for (const invalid of ["0", "-1", "01", "1.5", "", " 1", "9223372036854775808"]) {
      expect(() => parseMinorUnits(invalid, "Amount", { allowZero: false })).toThrow(ProductError);
    }
  });

  test("admits zero only where the caller allows it", () => {
    expect(parseMinorUnits("0", "Selling price", { allowZero: true })).toBe(0n);
    expect(() => parseMinorUnits("0", "Movement quantity", { allowZero: false })).toThrow(
      "Movement quantity must be a positive integer",
    );
    expect(() => parseMinorUnits("00", "Selling price", { allowZero: true })).toThrow(
      "Selling price must be a non-negative integer",
    );
    expect(() =>
      parseMinorUnits("9223372036854775808", "Selling price", { allowZero: true }),
    ).toThrow(ProductError);
  });
});
