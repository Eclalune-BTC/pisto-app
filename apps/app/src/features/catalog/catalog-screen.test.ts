import type { ProductDetail } from "@pisto/contracts";
import { createInstance } from "i18next";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  FolderCog: () => null,
  Info: () => null,
  Plus: () => null,
  Search: () => null,
}));

import { i18n } from "@/i18n/config";
import { esSV } from "@/i18n/resources/es-SV";
import { CatalogScreen } from "./catalog-screen";

const noop = () => undefined;
const props: ComponentProps<typeof CatalogScreen> = {
  canManage: true,
  categories: [],
  categoriesError: false,
  categoriesHasNextPage: false,
  categoriesLoading: false,
  categoriesLoadingMore: false,
  categoryId: null,
  onCategoryChange: noop,
  onCreateProduct: noop,
  onLoadMore: noop,
  onLoadMoreCategories: noop,
  onManageCategories: noop,
  onOpenProduct: noop,
  onRetry: noop,
  onRetryCategories: noop,
  onSearchChange: noop,
  onStatusChange: noop,
  search: "Coffee",
  showReadOnlyNotice: false,
  state: { status: "ready", items: [], hasNextPage: false, loadingMore: false },
  status: "active",
};

const item: ProductDetail = {
  product: {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Coffee & tea",
    categoryId: null,
    sku: null,
    sellingPriceMinorUnits: "1250",
    sellingPriceCurrency: "USD",
    sellingPriceCurrencyMinorUnitDigits: 2,
    quantityPrecision: 3,
    lowStockThresholdMinorUnits: "3000",
    tracked: true,
    unitKind: "kilogram",
    status: "archived",
    createdAt: "2026-09-26T12:00:00.000Z",
    updatedAt: "2026-09-26T12:00:00.000Z",
  },
  stock: {
    productId: "10000000-0000-4000-8000-000000000001",
    onHandMinorUnits: "2500",
    quantityPrecision: 3,
    lowStockThresholdMinorUnits: "3000",
    lowStock: true,
  },
};

describe("catalog translations", () => {
  test.each(["loading", "error", "offline"] as const)(
    "keeps translated query controls available while %s",
    (status) => {
      const markup = renderToStaticMarkup(
        createElement(CatalogScreen, { ...props, state: { status } }),
      );
      expect(markup).toContain(`aria-label="${i18n.t("catalog.list.searchLabel")}"`);
      expect(markup).toContain('value="Coffee"');
      expect(markup).toContain(
        `aria-label="${i18n.t("catalog.list.statusLabel")}: ${i18n.t("catalog.list.statuses.active")}"`,
      );
      expect(markup).not.toContain(i18n.t("catalog.list.emptyTitle"));
      expect(markup).not.toContain("catalog.list.");
    },
  );

  test("preserves interpolated labels, exact money, units and stock status", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogScreen, {
        ...props,
        state: {
          status: "ready",
          items: [item],
          hasNextPage: true,
          loadingMore: false,
          stale: true,
        },
      }),
    );
    expect(markup).toContain(i18n.t("catalog.list.openProduct", { name: "Coffee &amp; tea" }));
    expect(markup).toContain("$12.50");
    expect(markup).toContain(`2.500 ${i18n.t("catalog.unitLabels.kilogram")}`);
    expect(markup).toContain(i18n.t("catalog.list.archived"));
    expect(markup).toContain(i18n.t("catalog.list.lowStock"));
    expect(markup).toContain(i18n.t("remote.stale"));
    expect(markup).toContain(i18n.t("catalog.list.loadMore"));
  });

  test("preserves absent price and untracked stock without manufacturing values", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogScreen, {
        ...props,
        state: {
          status: "ready",
          hasNextPage: false,
          loadingMore: false,
          items: [
            {
              product: {
                ...item.product,
                tracked: false,
                sellingPriceMinorUnits: null,
                sellingPriceCurrency: null,
                sellingPriceCurrencyMinorUnitDigits: null,
              },
              stock: null,
            },
          ],
        },
      }),
    );
    expect(markup).toContain(i18n.t("catalog.list.noPrice"));
    expect(markup).toContain(i18n.t("catalog.list.stockNotTracked"));
    expect(markup).not.toContain("$0.00");
  });

  test("resolves screen and boundary text from the supplied translation provider", () => {
    const translator = createInstance();
    translator.init({
      initAsync: false,
      lng: "es-SV",
      fallbackLng: false,
      resources: {
        "es-SV": {
          translation: {
            ...esSV,
            catalog: {
              ...esSV.catalog,
              list: { ...esSV.catalog.list, title: "Provider title", errorTitle: "Provider error" },
            },
          },
        },
      },
    });
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n: translator },
        createElement(CatalogScreen, { ...props, state: { status: "error" } }),
      ),
    );
    expect(markup).toContain("Provider title");
    expect(markup).toContain("Provider error");
    expect(markup).not.toContain(i18n.t("catalog.list.errorTitle"));
  });
});
