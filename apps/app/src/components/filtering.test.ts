import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#71717A") : "#71717A",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));

import { CatalogScreen } from "@/features/catalog/catalog-screen";
import { CustomersScreen } from "@/features/customers/customers-screen";
import { ReceivablesScreen } from "@/features/receivables/receivables-screen";
import { i18n } from "@/i18n/config";
import { Button, ButtonText } from "./ui/button";

const noop = () => undefined;

describe("stable query controls rendered through result transitions", () => {
  test("hides cached category names and all controls after catalog access is denied", () => {
    const markup = renderToStaticMarkup(
      createElement(CatalogScreen, {
        canManage: true,
        categories: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            name: "Private cached category",
            status: "active",
            createdAt: "2026-09-10T12:00:00.000Z",
            updatedAt: "2026-09-10T12:00:00.000Z",
          },
        ],
        categoriesError: true,
        categoriesLoading: false,
        categoryId: null,
        onCategoryChange: noop,
        onLoadMore: noop,
        onRetry: noop,
        onRetryCategories: noop,
        onSearchChange: noop,
        onStatusChange: noop,
        onStockChange: noop,
        search: "Private search",
        state: { status: "denied" },
        status: "active",
        stock: null,
      }),
    );
    expect(markup).toContain(i18n.t("catalog.list.deniedTitle"));
    expect(markup).not.toContain("Private cached category");
    expect(markup).not.toContain("Private search");
    expect(markup).not.toContain(`>${i18n.t("catalog.list.createProduct")}<`);
    expect(markup).not.toContain(`>${i18n.t("catalog.list.manageCategories")}<`);
  });
  const customerList = {
    balanceFor: () => ({ kind: "loading" }) as const,
    canCreate: true,
    onLoadMore: noop,
    onRetry: noop,
    onSearchChange: noop,
    onStatusChange: noop,
    onStockChange: noop,
    query: "Mar",
    search: "Mar",
    searching: false,
    status: "active",
    stock: null,
  } as const;

  test.each(["loading", "error", "offline"] as const)(
    "keeps customer search, filters and creation available during %s",
    (kind) => {
      const markup = renderToStaticMarkup(
        createElement(CustomersScreen, { ...customerList, state: { kind } }),
      );

      expect(markup).toContain(`aria-label="${i18n.t("customers.list.searchLabel")}"`);
      expect(markup).toContain('value="Mar"');
      expect(markup).toContain(
        `aria-label="${i18n.t("customers.list.statusFilter")}: ${i18n.t("customers.list.filterActive")}"`,
      );
      expect(markup).toContain('aria-checked="true"');
      expect(markup).toContain(`>${i18n.t("customers.list.create")}<`);
    },
  );

  test("keeps the selected receivable filter available after its request fails", () => {
    const markup = renderToStaticMarkup(
      createElement(ReceivablesScreen, {
        canCreate: true,
        customerFilter: null,
        customerFilterRef: { current: null },
        customerNameFor: () => ({ kind: "unavailable" }) as const,
        filters: { state: "overdue" },
        onChooseCustomer: noop,
        onClearCustomer: noop,
        onClearFilters: noop,
        onLoadMore: noop,
        onRegisterPayment: noop,
        onRetry: noop,
        onStateChange: noop,
        state: { kind: "error" },
      }),
    );
    expect(markup).toContain(
      `aria-label="${i18n.t("receivables.list.stateFilter")}: ${i18n.t("receivables.list.filterOverdue")}"`,
    );
    expect(markup).toContain(`>${i18n.t("receivables.list.create")}<`);
  });

  test("does not expose customer filters or creation after a denied read", () => {
    const markup = renderToStaticMarkup(
      createElement(CustomersScreen, { ...customerList, state: { kind: "denied" } }),
    );
    expect(markup).toContain(i18n.t("customers.list.deniedTitle"));
    expect(markup).not.toContain(`aria-label="${i18n.t("customers.list.searchLabel")}"`);
    expect(markup).not.toContain(`>${i18n.t("customers.list.create")}<`);
  });

  test("retains the action name and disabled state while a composed button submits", () => {
    const markup = renderToStaticMarkup(
      createElement(
        Button,
        { loading: true, variant: "secondary" },
        createElement(ButtonText, { variant: "secondary" }, "Confirmar pago"),
      ),
    );
    expect(markup).toContain("Confirmar pago");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('aria-disabled="true"');
  });
});
