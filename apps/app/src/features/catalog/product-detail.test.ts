import type { InventoryMovement, ProductDetail } from "@pisto/contracts";
import { type ComponentProps, createElement, type ReactNode } from "react";
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
// Menus render their items so the static markup exposes every offered action.
vi.mock("@/components/ui/dropdown-menu", () => {
  const passthrough = ({ children }: { children?: ReactNode }) => children ?? null;
  return {
    DropdownMenu: passthrough,
    DropdownMenuTrigger: passthrough,
    DropdownMenuContent: ({ children }: { children: ReactNode }) =>
      createElement("section", { "data-testid": "menu" }, children),
    DropdownMenuSeparator: () => createElement("hr"),
    DropdownMenuItem: ({ children }: { children: ReactNode }) =>
      createElement("div", { role: "menuitem" }, children),
  };
});
vi.mock("@/components/ui/confirm-dialog", () => ({
  ConfirmDialog: (props: { open: boolean; title: string; disabled: boolean }) =>
    props.open
      ? createElement("dialog", { "data-disabled": String(props.disabled) }, props.title)
      : null,
}));

import { i18n } from "@/i18n/config";
import { ProductDetailScreen } from "./product-detail-screen";

const noop = () => undefined;
const timestamp = "2026-09-27T18:00:00.000Z";
const detail: ProductDetail = {
  product: {
    id: "product-a",
    name: "Café molido",
    categoryId: "category-a",
    sku: "CAFE-250",
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
  },
  stock: {
    productId: "product-a",
    onHandMinorUnits: "2500",
    quantityPrecision: 3,
    lowStockThresholdMinorUnits: "3000",
    lowStock: true,
  },
};
const movement: InventoryMovement = {
  id: "movement-a",
  productId: "product-a",
  action: "receive",
  quantityMinorUnits: "2500",
  deltaMinorUnits: "2500",
  quantityPrecision: 3,
  reason: "Pedido del proveedor",
  occurredAt: timestamp,
  occurredLocalDate: "2026-09-27",
  occurredLocalTime: "12:00",
  timeZone: "America/El_Salvador",
  createdByUserId: "user-a",
  reversesMovementId: null,
  reversedByMovementId: null,
  createdAt: timestamp,
};
const props: ComponentProps<typeof ProductDetailScreen> = {
  archive: {
    onCancel: noop,
    onConfirm: noop,
    onOpen: noop,
    open: false,
    phase: "idle",
    returnFocus: null,
  },
  canManage: true,
  canRecordMovement: true,
  categoryName: "Bebidas",
  detail,
  isStale: false,
  movements: { items: [movement], read: "ready" },
  onRetry: noop,
  onRetryMovements: noop,
  refreshing: false,
  timeZone: "America/El_Salvador",
};
const t = i18n.t;

function render(changes: Partial<ComponentProps<typeof ProductDetailScreen>> = {}) {
  return renderToStaticMarkup(createElement(ProductDetailScreen, { ...props, ...changes }));
}

describe("product detail", () => {
  test("states the exact price, balance and minimum with their units", () => {
    const markup = render();
    expect(markup).toContain("$12.50");
    expect(markup).toContain("2.500 kg");
    expect(markup).toContain("3.000 kg");
    expect(markup).toContain(t("catalog.detail.lowStockDetail"));
    expect(markup).toContain("CAFE-250");
    expect(markup).toContain("Bebidas");
    expect(markup).toContain(t("catalog.unitLabels.kilogram"));
    expect(markup).toContain(t("catalog.detail.precisionValue", { count: 3 }));
    expect(markup).toContain("+2.500 kg");
    expect(markup).toContain(movement.reason);
    expect(markup).toContain(t("catalog.detail.viewHistory"));
  });

  test("offers recording, editing and archiving to a manager of a tracked product", () => {
    const markup = render();
    expect(markup).toContain(`>${t("inventory.product.recordMovement")}<`);
    expect(markup).toContain(`>${t("catalog.detail.edit")}<`);
    expect(markup).toContain(`>${t("catalog.detail.archive")}<`);
  });

  test("offers nothing to change to a read-only role or on an archived product", () => {
    for (const markup of [
      render({ canManage: false, canRecordMovement: false }),
      render({ detail: { ...detail, product: { ...detail.product, status: "archived" } } }),
    ]) {
      expect(markup).not.toContain(`>${t("inventory.product.recordMovement")}<`);
      expect(markup).not.toContain(`>${t("catalog.detail.edit")}<`);
      expect(markup).not.toContain(`>${t("catalog.detail.archive")}<`);
    }
    expect(
      render({ detail: { ...detail, product: { ...detail.product, status: "archived" } } }),
    ).toContain(t("catalog.detail.archivedDescription"));
  });

  test("states an untracked product with its price only and no movement history", () => {
    const markup = render({
      detail: {
        product: { ...detail.product, tracked: false, lowStockThresholdMinorUnits: null },
        stock: null,
      },
      movements: null,
    });
    expect(markup).toContain("$12.50");
    expect(markup).not.toContain(`>${t("catalog.detail.onHand")}<`);
    expect(markup).not.toContain(`>${t("catalog.detail.threshold")}<`);
    expect(markup).not.toContain(t("catalog.detail.movementsTitle"));
    expect(markup).not.toContain(`>${t("inventory.product.recordMovement")}<`);
    expect(markup).toContain(`>${t("catalog.detail.edit")}<`);
  });

  test("shows an absent price or minimum as a dash and says once what is missing", () => {
    const markup = render({
      detail: {
        product: {
          ...detail.product,
          lowStockThresholdMinorUnits: null,
          sellingPriceCurrency: null,
          sellingPriceCurrencyMinorUnitDigits: null,
          sellingPriceMinorUnits: null,
        },
        stock: {
          productId: "product-a",
          onHandMinorUnits: "2500",
          quantityPrecision: 3,
          lowStockThresholdMinorUnits: null,
          lowStock: false,
        },
      },
    });
    expect(markup.split(t("catalog.detail.noPrice"))).toHaveLength(2);
    expect(markup.split(t("catalog.detail.noThreshold"))).toHaveLength(2);
    expect(markup.split(">—<")).toHaveLength(3);
  });

  test("asks for no attention on the balance of an archived product", () => {
    const markup = render({
      detail: { ...detail, product: { ...detail.product, status: "archived" } },
    });
    expect(markup).toContain("2.500 kg");
    expect(markup).not.toContain(t("catalog.detail.lowStockDetail"));
  });

  test("offers an empty history the action that starts it", () => {
    const empty = render({ movements: { items: [], read: "ready" } });
    expect(empty).toContain(t("inventory.history.emptyTitle"));
    expect(empty.split(`>${t("inventory.product.recordMovement")}<`)).toHaveLength(3);
    const readOnly = render({ canRecordMovement: false, movements: { items: [], read: "ready" } });
    expect(readOnly).not.toContain(`>${t("inventory.product.recordMovement")}<`);
  });

  test("never names a category it has not read and keeps a failed history visible as failed", () => {
    const markup = render({
      categoryName: undefined,
      movements: { items: [], read: "error" },
    });
    expect(markup).not.toContain("Bebidas");
    expect(markup).toContain(t("inventory.history.unavailableTitle"));
    expect(markup).not.toContain(t("inventory.history.emptyTitle"));
    expect(render({ categoryName: null })).toContain(t("catalog.detail.noCategory"));
  });

  test("keeps the archive confirmation blocked once management access is lost", () => {
    const markup = render({
      archive: { ...props.archive, open: true },
      canManage: false,
    });
    expect(markup).toContain(t("catalog.detail.archiveTitle", { name: "Café molido" }));
    expect(markup).toContain('data-disabled="true"');
  });

  test("keeps every action in place on a stale read but blocks a new archive", () => {
    const markup = render({ archive: { ...props.archive, open: true }, isStale: true });
    expect(markup).toContain(`>${t("catalog.detail.edit")}<`);
    expect(markup).toContain(`>${t("catalog.detail.archive")}<`);
    expect(markup).toContain('data-disabled="true"');
    expect(render({ archive: { ...props.archive, open: true } })).toContain(
      'data-disabled="false"',
    );
  });
});
