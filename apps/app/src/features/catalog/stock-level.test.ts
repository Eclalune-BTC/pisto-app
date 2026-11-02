import type { ProductStock } from "@pisto/contracts";
import { describe, expect, test } from "vitest";
import { stockLevel, stockState } from "./stock-level";

const stock = (onHandMinorUnits: string, lowStockThresholdMinorUnits: string | null) =>
  ({
    lowStock:
      lowStockThresholdMinorUnits !== null &&
      BigInt(onHandMinorUnits) <= BigInt(lowStockThresholdMinorUnits),
    lowStockThresholdMinorUnits,
    onHandMinorUnits,
    productId: "product",
    quantityPrecision: 0,
  }) satisfies ProductStock;

describe("product stock state", () => {
  test("separates out of stock, low stock, available and untracked products", () => {
    expect(stockState(null)).toBe("untracked");
    expect(stockState(stock("0", "12"))).toBe("out");
    expect(stockState(stock("0", null))).toBe("out");
    expect(stockState(stock("3", "8"))).toBe("low");
    expect(stockState(stock("8", "8"))).toBe("low");
    expect(stockState(stock("9", "8"))).toBe("available");
    expect(stockState(stock("40", null))).toBe("available");
  });

  test("scales the bar to twice the minimum or to a larger stock", () => {
    expect(stockLevel(stock("3", "8"))).toEqual({ fill: 187, minimum: 500 });
    expect(stockLevel(stock("84", "24"))).toEqual({ fill: 1000, minimum: 285 });
    expect(stockLevel(stock("0", "12"))).toEqual({ fill: 0, minimum: 500 });
    expect(stockLevel(stock("0", "0"))).toEqual({ fill: 0, minimum: 0 });
    expect(stockLevel(stock("15", null))).toBeNull();
  });
});
