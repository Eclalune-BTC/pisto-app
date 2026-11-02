import type { ProductStock } from "@pisto/contracts";

export type StockState = "untracked" | "out" | "low" | "available";

/** Out of stock wins over low stock, so a product at zero is never called merely "low". */
export function stockState(stock: ProductStock | null): StockState {
  if (!stock) return "untracked";
  if (BigInt(stock.onHandMinorUnits) <= 0n) return "out";
  return stock.lowStock ? "low" : "available";
}

/**
 * Positions on a stock bar in tenths of a percent. The track spans twice the minimum, or the
 * stock when it is larger, so the minimum marker sits in a stable place across rows. A product
 * without a minimum has nothing to compare against and gets no bar.
 */
export function stockLevel(stock: ProductStock): { fill: number; minimum: number } | null {
  if (stock.lowStockThresholdMinorUnits === null) return null;
  const minimum = BigInt(stock.lowStockThresholdMinorUnits);
  const onHand = BigInt(stock.onHandMinorUnits);
  const held = onHand > 0n ? onHand : 0n;
  const scale = held > minimum * 2n ? held : minimum * 2n;
  if (scale === 0n) return { fill: 0, minimum: 0 };
  return { fill: Number((held * 1000n) / scale), minimum: Number((minimum * 1000n) / scale) };
}
