import type { InventoryMovement, Product, ProductStock } from "@pisto/contracts";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { i18n } from "@/i18n/config";
import { InventoryScreen } from "./inventory-screen";
import { ProductStockScreen } from "./product-stock-screen";

const noop = () => undefined;
const timestamp = "2026-09-27T18:00:00.000Z";
const product: Product = {
  id: "product-a",
  name: "Whole bean coffee with a long product name",
  categoryId: "category-a",
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
const props: ComponentProps<typeof ProductStockScreen> = {
  canManage: true,
  isStale: false,
  movements: {
    items: [movement],
    page: { hasMore: true, loadingMore: false, onLoadMore: noop },
    read: "ready",
  },
  onRetry: noop,
  onRetryMovements: noop,
  onReverse: noop,
  product,
  refreshing: false,
  stock,
};
const reverseLabel = i18n.t("inventory.history.rowActions", {
  action: i18n.t("inventory.movementActions.adjust_out"),
  date: "27 sept 2026, 12:00",
});

function renderStock(changes: Partial<ComponentProps<typeof ProductStockScreen>> = {}) {
  return renderToStaticMarkup(createElement(ProductStockScreen, { ...props, ...changes }));
}

describe("inventory record tables", () => {
  test("keeps exact signed quantities, the business-local moment, the reason and the cursor", () => {
    const markup = renderStock();
    expect(markup).toContain("−1.500 kg");
    expect(markup).toContain(movement.reason);
    expect(markup).toContain("27 sept 2026, 12:00");
    expect(markup).toContain(i18n.t("inventory.movementActions.adjust_out"));
    expect(markup).toContain(i18n.t("common.loadMore"));
    expect(markup).toContain(`aria-label="${reverseLabel}"`);
    expect(markup).toContain("2.500 kg");
    expect(markup).toContain("3.000 kg");
    expect(markup).toContain(i18n.t("catalog.list.lowStock"));
    // No reference column while no row is linked to another.
    expect(markup).not.toContain(i18n.t("dataTable.columns.reference"));
  });

  test.each(["read-only", "archived", "reversed", "reversal"] as const)(
    "withdraws reversal for a %s movement",
    (reason) => {
      const item: InventoryMovement = {
        ...movement,
        action: reason === "reversal" ? "reverse" : movement.action,
        deltaMinorUnits: reason === "reversal" ? "1500" : movement.deltaMinorUnits,
        reversesMovementId: reason === "reversal" ? "original-movement" : null,
        reversedByMovementId: reason === "reversed" ? "reversal-movement" : null,
      };
      const markup = renderStock({
        canManage: reason !== "read-only",
        movements: {
          items: [item],
          page: { hasMore: false, loadingMore: false, onLoadMore: noop },
          read: "ready",
        },
        product: { ...product, status: reason === "archived" ? "archived" : "active" },
      });
      const rowMenu = i18n.t("inventory.history.rowActions", {
        action: i18n.t(`inventory.movementActions.${item.action}`),
        date: "27 sept 2026, 12:00",
      });
      expect(markup).not.toContain(`aria-label="${rowMenu}"`);
      expect(markup).not.toContain(i18n.t("common.loadMore"));
      expect(markup).not.toContain("original-movement");
      expect(markup).not.toContain("reversal-movement");
      if (reason === "reversal") {
        expect(markup).toContain(i18n.t("inventory.history.reversesEarlier"));
        expect(markup).toContain("+1.500 kg");
      }
      if (reason === "reversed") expect(markup).toContain(i18n.t("inventory.history.reversed"));
      if (reason === "archived") {
        expect(markup).not.toContain(i18n.t("inventory.product.recordMovement"));
        expect(markup).toContain(i18n.t("inventory.product.archivedDescription"));
      }
    },
  );

  test("names the movement a loaded reversal undoes instead of its identifier", () => {
    const reversal: InventoryMovement = {
      ...movement,
      id: "movement-b",
      action: "reverse",
      deltaMinorUnits: "1500",
      occurredLocalTime: "13:30",
      reason: "Counted twice",
      reversesMovementId: movement.id,
    };
    const markup = renderStock({
      movements: {
        items: [reversal, { ...movement, reversedByMovementId: reversal.id }],
        page: { hasMore: false, loadingMore: false, onLoadMore: noop },
        read: "ready",
      },
    });
    // Compact rows name the reversed movement under the reversal's type, not in a column.
    expect(markup).not.toContain(i18n.t("dataTable.columns.reference"));
    expect(markup).toContain(
      i18n.t("inventory.history.reverses", {
        action: i18n.t("inventory.movementActions.adjust_out"),
        date: "27 sept 2026, 12:00",
      }),
    );
    expect(markup).toContain(i18n.t("inventory.history.reversed"));
    expect(markup).not.toContain(movement.id);
  });

  test("asks for no attention on an archived product and offers an empty history its action", () => {
    const archived = renderStock({ product: { ...product, status: "archived" } });
    expect(archived).toContain("2.500 kg");
    expect(archived).not.toContain(i18n.t("inventory.product.lowStockDetail"));
    expect(archived).not.toContain(i18n.t("catalog.list.lowStock"));

    const page = { hasMore: false, loadingMore: false, onLoadMore: noop };
    const empty = renderStock({ movements: { items: [], page, read: "ready" } });
    expect(empty).toContain(i18n.t("inventory.history.emptyTitle"));
    expect(empty.split(`>${i18n.t("inventory.product.recordMovement")}<`)).toHaveLength(3);
    const readOnly = renderStock({
      canManage: false,
      movements: { items: [], page, read: "ready" },
    });
    expect(readOnly).not.toContain(`>${i18n.t("inventory.product.recordMovement")}<`);
  });

  test("shows an absent minimum as a dash and says once that it is missing", () => {
    const markup = renderStock({
      stock: { ...stock, lowStock: false, lowStockThresholdMinorUnits: null },
    });
    expect(markup.split(i18n.t("inventory.product.noThreshold"))).toHaveLength(2);
    expect(markup).toContain(">—<");
  });

  test("keeps the balance and states a failed history read without an empty table", () => {
    const markup = renderStock({
      movements: {
        items: [],
        page: { hasMore: false, loadingMore: false, onLoadMore: noop },
        read: "error",
      },
    });
    expect(markup).toContain(i18n.t("inventory.history.unavailableTitle"));
    expect(markup).not.toContain(i18n.t("inventory.history.emptyTitle"));
    expect(markup).toContain("2.500 kg");
  });

  test("keeps exact stock, unit, threshold, SKU and the stale notice in the stock table", () => {
    const markup = renderToStaticMarkup(
      createElement(InventoryScreen, {
        categories: {
          complete: true,
          failed: false,
          names: new Map([["category-a", "Café en grano"]]),
        },
        lowStockOnly: true,
        onClearFilters: noop,
        onLoadMore: noop,
        onLowStockOnlyChange: noop,
        onRetry: noop,
        onSearchChange: noop,
        search: "coffee",
        searching: false,
        state: {
          status: "ready",
          items: [
            { product, stock },
            {
              product: { ...product, id: "product-b", lowStockThresholdMinorUnits: null },
              stock: { ...stock, productId: "product-b", lowStockThresholdMinorUnits: null },
            },
          ],
          hasNextPage: true,
          loadingMore: false,
          previous: false,
          refreshing: false,
          stale: true,
        },
      }),
    );
    expect(markup).toContain(product.name);
    expect(markup).toContain("COFFEE-1");
    expect(markup).toContain("Café en grano");
    expect(markup).toContain("2.500 kg");
    expect(markup).toContain("3.000 kg");
    expect(markup).toContain(i18n.t("inventory.list.noThreshold"));
    expect(markup).toContain(i18n.t("catalog.list.lowStock"));
    expect(markup).toContain(i18n.t("remote.stale"));
    expect(markup).toContain(i18n.t("common.loadMore"));
    expect(markup).toContain(
      `aria-label="${i18n.t("inventory.list.filterLabel")}: ${i18n.t("inventory.list.filters.low")}"`,
    );
  });

  test("hides the category column for a role that cannot read the catalog", () => {
    const markup = renderToStaticMarkup(
      createElement(InventoryScreen, {
        categories: null,
        lowStockOnly: false,
        onClearFilters: noop,
        onLoadMore: noop,
        onLowStockOnlyChange: noop,
        onRetry: noop,
        onSearchChange: noop,
        search: "",
        searching: false,
        state: {
          status: "ready",
          items: [{ product, stock }],
          hasNextPage: false,
          loadingMore: false,
          previous: false,
          refreshing: false,
          stale: false,
        },
      }),
    );
    expect(markup).not.toContain(i18n.t("dataTable.columns.category"));
    expect(markup).not.toContain(i18n.t("catalog.list.categoryUnavailable"));
  });
});
