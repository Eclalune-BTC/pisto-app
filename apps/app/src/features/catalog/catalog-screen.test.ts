import type { ProductDetail } from "@pisto/contracts";
import { createInstance } from "i18next";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
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
import { esSV } from "@/i18n/resources/es-SV";
import { CatalogScreen } from "./catalog-screen";

const noop = () => undefined;
const props: ComponentProps<typeof CatalogScreen> = {
  canManage: true,
  categories: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      name: "Bebidas",
      status: "active",
      createdAt: "2026-09-26T12:00:00.000Z",
      updatedAt: "2026-09-26T12:00:00.000Z",
    },
  ],
  categoriesError: false,
  categoriesLoading: false,
  categoryId: null,
  onCategoryChange: noop,
  onClearFilters: noop,
  onLoadMore: noop,
  onRetry: noop,
  onRetryCategories: noop,
  onSearchChange: noop,
  onStatusChange: noop,
  search: "Coffee",
  state: { status: "ready", items: [], hasNextPage: false, loadingMore: false },
  status: "active",
};

const item: ProductDetail = {
  product: {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Coffee & tea",
    categoryId: "20000000-0000-4000-8000-000000000001",
    sku: "COF-250",
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

function render(changes: Partial<ComponentProps<typeof CatalogScreen>>) {
  return renderToStaticMarkup(createElement(CatalogScreen, { ...props, ...changes }));
}

describe("catalog list", () => {
  test.each(["loading", "error", "offline"] as const)(
    "keeps the translated search and filters available while %s",
    (status) => {
      const markup = render({ state: { status } });
      expect(markup).toContain(`aria-label="${i18n.t("catalog.list.searchLabel")}"`);
      expect(markup).toContain('value="Coffee"');
      expect(markup).toContain(
        `aria-label="${i18n.t("catalog.list.statusLabel")}: ${i18n.t("catalog.list.statuses.active")}"`,
      );
      expect(markup).not.toContain(i18n.t("catalog.list.emptyTitle"));
      expect(markup).not.toContain(i18n.t("catalog.list.emptyFilteredTitle"));
      expect(markup).not.toContain("catalog.list.");
    },
  );

  test("opens each product through a real link and shows exact money, units and stock state", () => {
    const markup = render({
      state: { status: "ready", items: [item], hasNextPage: true, loadingMore: false, stale: true },
      status: "all",
    });
    expect(markup).toContain("Coffee &amp; tea");
    expect(markup).toContain(
      `href="${JSON.stringify({
        pathname: "/operate/catalog/[productId]",
        params: { productId: item.product.id },
      }).replaceAll('"', "&quot;")}"`,
    );
    expect(markup).toContain("COF-250");
    expect(markup).toContain("Bebidas");
    expect(markup).toContain("$12.50");
    expect(markup).toContain("2.500 kg");
    expect(markup).toContain(i18n.t("catalog.list.lowStock"));
    expect(markup).toContain(i18n.t("catalog.status.archived"));
    expect(markup).toContain(i18n.t("remote.stale"));
    expect(markup).toContain(i18n.t("common.loadMore"));
  });

  test("states an absent price and untracked stock without manufacturing values", () => {
    const markup = render({
      state: {
        status: "ready",
        hasNextPage: false,
        loadingMore: false,
        items: [
          {
            product: {
              ...item.product,
              categoryId: null,
              sku: null,
              tracked: false,
              lowStockThresholdMinorUnits: null,
              sellingPriceMinorUnits: null,
              sellingPriceCurrency: null,
              sellingPriceCurrencyMinorUnitDigits: null,
            },
            stock: null,
          },
        ],
      },
    });
    expect(markup).toContain(i18n.t("catalog.list.noPrice"));
    expect(markup).toContain(i18n.t("catalog.list.notTracked"));
    expect(markup).toContain(i18n.t("catalog.list.noCategory"));
    expect(markup).not.toContain("$0.00");
    expect(markup).not.toContain(i18n.t("common.loadMore"));
  });

  test("names a category only once it is read and never guesses one", () => {
    const loading = render({
      categories: [],
      categoriesLoading: true,
      state: { status: "ready", items: [item], hasNextPage: false, loadingMore: false },
    });
    expect(loading).not.toContain(i18n.t("catalog.list.categoryUnavailable"));
    const failed = render({
      categories: [],
      categoriesError: true,
      state: { status: "ready", items: [item], hasNextPage: false, loadingMore: false },
    });
    expect(failed).toContain(i18n.t("catalog.list.categoryUnavailable"));
    expect(failed).toContain(i18n.t("catalog.list.categoriesUnavailable"));
  });

  test("dims previous results while a new search loads instead of flashing a skeleton", () => {
    const markup = render({
      state: {
        status: "ready",
        items: [item],
        hasNextPage: true,
        loadingMore: false,
        previous: true,
      },
    });
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Coffee &amp; tea");
    expect(markup).not.toContain(i18n.t("common.loadMore"));
  });

  test("offers creation on an empty catalog and clearing on an empty search", () => {
    const empty = render({ search: "" });
    expect(empty).toContain(i18n.t("catalog.list.emptyTitle"));
    expect(empty).toContain(`>${i18n.t("catalog.list.createProduct")}<`);
    const filtered = render({ search: "missing" });
    expect(filtered).toContain(i18n.t("catalog.list.emptyFilteredTitle"));
    expect(filtered).toContain(i18n.t("filters.reset"));
    const readOnly = render({ canManage: false, search: "" });
    expect(readOnly).not.toContain(`>${i18n.t("catalog.list.createProduct")}<`);
    expect(readOnly).toContain(`>${i18n.t("catalog.list.manageCategories")}<`);
  });

  test("hides cached records and every control after a denial", () => {
    const markup = render({ state: { status: "denied" } });
    expect(markup).toContain(i18n.t("catalog.list.deniedTitle"));
    expect(markup).not.toContain("Bebidas");
    expect(markup).not.toContain('value="Coffee"');
    expect(markup).not.toContain(`>${i18n.t("catalog.list.createProduct")}<`);
  });

  test("resolves screen text from the supplied translation provider", () => {
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
              list: {
                ...esSV.catalog.list,
                title: "Provider title",
                unavailableTitle: "Provider error",
              },
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
    expect(markup).not.toContain(i18n.t("catalog.list.unavailableTitle"));
  });
});
