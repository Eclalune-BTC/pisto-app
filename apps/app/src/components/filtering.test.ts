import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({ useUniwind: () => ({ theme: "light" }) }));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
vi.mock("lucide-react-native", () => ({
  AlertTriangle: () => null,
  CalendarDays: () => null,
  ChevronRight: () => null,
  FolderCog: () => null,
  Info: () => null,
  Plus: () => null,
  Search: () => null,
}));

import { CatalogScreen } from "@/features/catalog/catalog-screen";
import { buildCustomersCopy } from "@/features/customers/copy";
import { CustomersScreen } from "@/features/customers/customers-screen";
import { ReceivablesScreen } from "@/features/receivables/receivables-screen";
import { buildReportsCopy } from "@/features/reports/copy";
import { ReportsScreen } from "@/features/reports/reports-screen";
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
        search: "Private search",
        showReadOnlyNotice: false,
        state: { status: "denied" },
        status: "active",
      }),
    );
    expect(markup).toContain(i18n.t("catalog.list.deniedTitle"));
    expect(markup).not.toContain("Private cached category");
    expect(markup).not.toContain("Private search");
    expect(markup).not.toContain(`>${i18n.t("catalog.list.createProduct")}<`);
    expect(markup).not.toContain(`>${i18n.t("catalog.list.manageCategories")}<`);
  });
  test.each(["loading", "error", "offline"] as const)(
    "keeps customer search and filters available during %s without a create action",
    (kind) => {
      const copy = buildCustomersCopy(i18n.t).customers.list;
      const markup = renderToStaticMarkup(
        createElement(CustomersScreen, {
          canManage: true,
          copy,
          onCreate: noop,
          onLoadMore: noop,
          onOpenCustomer: noop,
          onRetry: noop,
          onSearchChange: noop,
          onStatusChange: noop,
          searchQuery: "Mar",
          state: { kind },
          status: "active",
        }),
      );

      expect(markup).toContain(`aria-label="${copy.searchLabel}"`);
      expect(markup).toContain('value="Mar"');
      expect(markup).toContain(`aria-label="${copy.filterLabel}: ${copy.active}"`);
      expect(markup).toContain('aria-pressed="true"');
      expect(markup).not.toContain(`>${copy.create}<`);
    },
  );

  test("keeps the selected receivable filter available after its request fails", () => {
    const copy = buildCustomersCopy(i18n.t).receivables.list;
    const markup = renderToStaticMarkup(
      createElement(ReceivablesScreen, {
        canManage: true,
        copy,
        customerNameFor: () => "",
        filter: "overdue",
        formatDate: (value: string) => value,
        formatMoney: (value: string) => value,
        onCreate: noop,
        onFilterChange: noop,
        onLoadMore: noop,
        onOpenReceivable: noop,
        onRetry: noop,
        state: { kind: "error" },
      }),
    );
    expect(markup).toContain(`aria-label="${copy.filterLabel}: ${copy.overdue}"`);
    expect(markup).not.toContain(`>${copy.charge}<`);
  });

  test("does not expose customer filters or creation after a denied read", () => {
    const copy = buildCustomersCopy(i18n.t).customers.list;
    const markup = renderToStaticMarkup(
      createElement(CustomersScreen, {
        canManage: true,
        copy,
        onCreate: noop,
        onLoadMore: noop,
        onOpenCustomer: noop,
        onRetry: noop,
        onSearchChange: noop,
        onStatusChange: noop,
        searchQuery: "Mar",
        state: { kind: "denied" },
        status: "active",
      }),
    );
    expect(markup).toContain(copy.deniedTitle);
    expect(markup).not.toContain(`aria-label="${copy.searchLabel}"`);
    expect(markup).not.toContain(`>${copy.create}<`);
  });

  test.each(["loading", "error", "offline"] as const)(
    "keeps report dates editable during %s without manufacturing report data",
    (kind) => {
      const copy = buildReportsCopy(i18n.t).screen;
      const markup = renderToStaticMarkup(
        createElement(ReportsScreen, {
          applying: kind === "loading",
          copy,
          endLocalDate: "2026-09-10",
          issue: null,
          locale: "es-SV",
          onApply: noop,
          onEndLocalDateChange: noop,
          onRetry: noop,
          onStartLocalDateChange: noop,
          startLocalDate: "2026-09-01",
          state: kind === "loading" ? { kind } : { kind, message: "The query is unavailable." },
        }),
      );
      expect(markup).toContain('value="2026-09-01"');
      expect(markup).toContain('value="2026-09-10"');
      expect(markup).not.toContain(copy.sections.period.salesGross);
    },
  );

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
