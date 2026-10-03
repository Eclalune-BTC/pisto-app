import type { InventoryMovement, Product, ProductStock } from "@pisto/contracts";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: () => "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  ArrowLeft: () => null,
  Search: () => null,
  Info: () => null,
}));

import { buildCatalogCopy } from "@/features/catalog/copy";
import { i18n } from "@/i18n/config";
import { InventoryScreen } from "./inventory-screen";
import { MovementHistory } from "./movement-history";

const noop = () => undefined;
const timestamp = "2026-09-27T18:00:00.000Z";
const copy = buildCatalogCopy(i18n.t);
const product: Product = {
  id: "product-a",
  name: "Whole bean coffee with a long product name",
  categoryId: null,
  sku: "COFFEE-1",
  sellingPriceMinorUnits: "1250",
  sellingPriceCurrency: "USD",
  sellingPriceCurrencyMinorUnitDigits: 2,
  quantityPrecision: 3,
  lowStockThresholdMinorUnits: "3000",
  tracked: true,
  unitKind: "kilogram",
  status: "active",
  createdAt: timestamp,
  updatedAt: timestamp,
};
const stock: ProductStock = {
  productId: product.id,
  onHandMinorUnits: "2500",
  quantityPrecision: 3,
  lowStockThresholdMinorUnits: "3000",
  lowStock: true,
};
const movement: InventoryMovement = {
  id: "movement-a",
  productId: product.id,
  action: "adjust_out",
  quantityMinorUnits: "1500",
  deltaMinorUnits: "-1500",
  quantityPrecision: 3,
  reason: "Full recorded reason",
  occurredAt: timestamp,
  occurredLocalDate: "2026-09-27",
  occurredLocalTime: "12:00",
  timeZone: "America/El_Salvador",
  createdByUserId: "user-a",
  reversesMovementId: null,
  reversedByMovementId: null,
  createdAt: timestamp,
};
const props: ComponentProps<typeof MovementHistory> = {
  canManage: true,
  copy: copy.movementHistory,
  onAddMovement: noop,
  onBack: noop,
  onLoadMore: noop,
  onRetry: noop,
  onReverse: noop,
  product,
  stock,
  showReadOnlyNotice: false,
  state: { status: "ready", items: [movement], hasNextPage: true, loadingMore: false },
};

describe("inventory record tables", () => {
  test("keeps signed quantities, complete occurrence, reason and real cursor controls", () => {
    const markup = renderToStaticMarkup(createElement(MovementHistory, props));
    expect(markup).toContain("−1.500");
    expect(markup).toContain(movement.reason);
    expect(markup).toContain(movement.occurredLocalDate);
    expect(markup).toContain(movement.occurredLocalTime);
    expect(markup).toContain(movement.timeZone);
    expect(markup).toContain(copy.movementHistory.loadMore);
    expect(markup).toContain(copy.movementHistory.reverse);
  });

  test.each(["read-only", "archived", "reversed", "reversal"] as const)(
    "withdraws reversal for %s",
    (reason) => {
      const item: InventoryMovement = {
        ...movement,
        action: reason === "reversal" ? "reverse" : movement.action,
        reversesMovementId: reason === "reversal" ? "original-movement" : null,
        reversedByMovementId: reason === "reversed" ? "reversal-movement" : null,
      };
      const markup = renderToStaticMarkup(
        createElement(MovementHistory, {
          ...props,
          canManage: reason !== "read-only",
          product: { ...product, status: reason === "archived" ? "archived" : "active" },
          state: { status: "ready", items: [item], hasNextPage: false, loadingMore: false },
        }),
      );
      expect(markup).not.toContain(`>${copy.movementHistory.reverse}<`);
      expect(markup).not.toContain(copy.movementHistory.loadMore);
      if (reason === "reversal") expect(markup).toContain("original-movement");
      if (reason === "reversed") expect(markup).toContain(copy.movementHistory.reversed);
    },
  );

  test("hides cached product identity, stock and action controls after denial", () => {
    const markup = renderToStaticMarkup(
      createElement(MovementHistory, { ...props, state: { status: "denied" } }),
    );
    expect(markup).toContain(copy.movementHistory.deniedTitle);
    expect(markup).not.toContain(product.name);
    expect(markup).not.toContain("2.500");
    expect(markup).not.toContain(copy.movementHistory.addMovement);
  });

  test("keeps exact stock, unit, threshold, SKU and read-only notice in the stock table", () => {
    const markup = renderToStaticMarkup(
      createElement(InventoryScreen, {
        copy: copy.inventory,
        lowStockOnly: true,
        onLoadMore: noop,
        onLowStockOnlyChange: noop,
        onOpenHistory: noop,
        onRetry: noop,
        onSearchChange: noop,
        search: "coffee",
        showReadOnlyNotice: true,
        state: {
          status: "ready",
          items: [{ product, stock }],
          hasNextPage: true,
          loadingMore: false,
          stale: true,
        },
      }),
    );
    expect(markup).toContain(product.name);
    expect(markup).toContain(product.sku);
    expect(markup).toContain("2.500");
    expect(markup).toContain("3.000");
    expect(markup).toContain(copy.unitLabels.kilogram);
    expect(markup).toContain(copy.inventory.lowStock);
    expect(markup).toContain(copy.inventory.readOnlyDescription);
    expect(markup).toContain(copy.inventory.stale);
    expect(markup).toContain(copy.inventory.loadMore);
  });
});
