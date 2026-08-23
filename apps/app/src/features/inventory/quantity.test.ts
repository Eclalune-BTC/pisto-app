import { describe, expect, test } from "vitest";

import { formatQuantityMinorUnits, parseQuantityToMinorUnits } from "./quantity";

describe("fixed-scale inventory quantity", () => {
  test("parses decimal user input without floating point", () => {
    expect(parseQuantityToMinorUnits("1.250", 3)).toEqual({ value: "1250" });
    expect(parseQuantityToMinorUnits("1,25", 3)).toEqual({ value: "1250" });
    expect(parseQuantityToMinorUnits("0002", 0)).toEqual({ value: "2" });
  });

  test("rejects excess precision, negative, zero, and int64 overflow", () => {
    expect(parseQuantityToMinorUnits("1.2345", 3)).toEqual({ error: "invalid-decimals" });
    expect(parseQuantityToMinorUnits("-1", 0)).toEqual({ error: "negative" });
    expect(parseQuantityToMinorUnits("0", 0)).toEqual({ error: "non-positive" });
    expect(parseQuantityToMinorUnits("9223372036854775808", 0)).toEqual({ error: "too-large" });
    expect(parseQuantityToMinorUnits("0", 0, { allowZero: true })).toEqual({ value: "0" });
  });

  test("formats canonical minor units at the product precision", () => {
    expect(formatQuantityMinorUnits("1250", 3)).toBe("1.250");
    expect(formatQuantityMinorUnits("5", 3)).toBe("0.005");
    expect(formatQuantityMinorUnits("5", 0)).toBe("5");
  });
});
