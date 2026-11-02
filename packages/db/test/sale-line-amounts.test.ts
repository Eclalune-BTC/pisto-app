import { describe, expect, test } from "bun:test";

import { ProductError } from "../src/errors.ts";
import { lineSubtotalMinorUnits, saleTotalMinorUnits } from "../src/sales/line-amounts.ts";

describe("itemized sale amounts", () => {
  test("multiplies whole units exactly", () => {
    expect(lineSubtotalMinorUnits(3n, 325n, 0)).toBe(975n);
    expect(lineSubtotalMinorUnits(1n, 0n, 0)).toBe(0n);
  });

  test("scales fractional quantities back and rounds half up to a minor unit", () => {
    // 1.250 kg × 3.33 = 4.1625 → 4.16
    expect(lineSubtotalMinorUnits(1250n, 333n, 3)).toBe(416n);
    // 0.5 × 0.01 = 0.005 → 0.01 (half rounds up)
    expect(lineSubtotalMinorUnits(5n, 1n, 1)).toBe(1n);
    // 0.4 × 0.01 = 0.004 → 0.00
    expect(lineSubtotalMinorUnits(4n, 1n, 1)).toBe(0n);
    // 0.15 × 0.03 = 0.0045 → 0.00, and 0.15 × 0.05 = 0.0075 → 0.01
    expect(lineSubtotalMinorUnits(15n, 3n, 2)).toBe(0n);
    expect(lineSubtotalMinorUnits(15n, 5n, 2)).toBe(1n);
  });

  test("keeps precision beyond floating point", () => {
    expect(lineSubtotalMinorUnits(3_000_000_000n, 3_000_000_000n, 0)).toBe(
      9_000_000_000_000_000_000n,
    );
    expect(saleTotalMinorUnits([4_000_000_000_000_000_000n, 5_000_000_000_000_000_000n])).toBe(
      9_000_000_000_000_000_000n,
    );
  });

  test("refuses totals that PostgreSQL bigint cannot store", () => {
    expect(() => lineSubtotalMinorUnits(4_000_000_000n, 4_000_000_000n, 0)).toThrow(ProductError);
    expect(() =>
      saleTotalMinorUnits([5_000_000_000_000_000_000n, 5_000_000_000_000_000_000n]),
    ).toThrow(ProductError);
    expect(saleTotalMinorUnits([9_223_372_036_854_775_807n])).toBe(9_223_372_036_854_775_807n);
  });
});
