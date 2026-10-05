import type { Product, ProductUnitKind } from "@pisto/contracts";
import type { TFunction } from "i18next";
import { formatMinorUnits } from "@/lib/money";
import { formatQuantity, formatQuantityMinorUnits } from "../inventory/quantity";

/** The price snapshot taken when the price was set, or null for a product sold without one. */
export function productPrice(product: Product, locale: string): string | null {
  const currency = product.sellingPriceCurrency;
  const digits = product.sellingPriceCurrencyMinorUnitDigits;
  if (product.sellingPriceMinorUnits === null || currency === null || digits === null) return null;
  return formatMinorUnits(product.sellingPriceMinorUnits, currency, digits, locale);
}

type Quantity = { minorUnits: string; precision: number; unitKind: ProductUnitKind };

/** "12 unidades", "2.500 kg": the exact quantity with its unit. */
export function quantityText(t: TFunction, locale: string, quantity: Quantity): string {
  return t(`catalog.quantity.${quantity.unitKind}`, {
    // Only the plural category depends on this number; the shown digits come from the text.
    count: Number(formatQuantityMinorUnits(quantity.minorUnits, quantity.precision)),
    value: formatQuantity(quantity.minorUnits, quantity.precision, locale),
  });
}

/** A movement's signed change, "+12 unidades" or "−1.500 kg", with a true minus sign. */
export function signedQuantityText(
  t: TFunction,
  locale: string,
  delta: Omit<Quantity, "minorUnits"> & { deltaMinorUnits: string },
): string {
  const negative = delta.deltaMinorUnits.startsWith("-");
  const magnitude = quantityText(t, locale, {
    minorUnits: negative ? delta.deltaMinorUnits.slice(1) : delta.deltaMinorUnits,
    precision: delta.precision,
    unitKind: delta.unitKind,
  });
  return `${negative ? "−" : "+"}${magnitude}`;
}
