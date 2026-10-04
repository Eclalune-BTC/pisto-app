import type { Sale } from "@pisto/contracts";
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
import { SalesHistory } from "./sales-history";

const timestamp = "2026-09-27T18:00:00.000Z";
const sale: Sale = {
  id: "sale-a",
  status: "posted",
  entryMode: "total_only",
  grossMinorUnits: "1250",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  occurredAt: timestamp,
  occurredLocalDate: "2026-09-27",
  occurredLocalTime: "12:00",
  timeZone: "America/El_Salvador",
  description: "Full sale description",
  correction: null,
  createdAt: timestamp,
};
const voided: Sale = {
  ...sale,
  id: "sale-b",
  status: "voided",
  description: null,
  correction: {
    id: "correction-b",
    kind: "void",
    reason: "Registered twice by mistake",
    originalSaleId: "sale-b",
    replacementSaleId: null,
    correctedAt: timestamp,
  },
};
const props: ComponentProps<typeof SalesHistory> = {
  canCorrect: true,
  canCreate: true,
  filter: "all",
  onCorrect: () => undefined,
  onFilterChange: () => undefined,
  onLoadMore: () => undefined,
  onRetry: () => undefined,
  state: {
    kind: "ready",
    items: [sale, voided],
    canCorrect: true,
    hasMore: true,
    loadingMore: true,
    stale: false,
    queriedAt: timestamp,
  },
  timeZone: "America/El_Salvador",
};
const t = i18n.t;
const render = (overrides: Partial<ComponentProps<typeof SalesHistory>> = {}) =>
  renderToStaticMarkup(createElement(SalesHistory, { ...props, ...overrides }));
const rowActions = t("sales.list.rowActions", { date: "" });
const filterGroup = `aria-label="${t("common.status")}"`;

describe("sales history", () => {
  test("opens each sale from its row and keeps exact amounts and status badges", () => {
    const markup = render();
    expect(markup).toContain("Full sale description");
    expect(markup).toContain("/operate/sales/[saleId]");
    expect(markup).toContain("sale-a");
    expect(markup).toContain("$12.50");
    expect(markup).toContain(`>${t("sales.posted")}<`);
    expect(markup).toContain(`>${t("sales.voided")}<`);
    expect(markup).toContain(t("common.noDescription"));
  });

  test("leaves the void reason to the sale detail instead of the row", () => {
    expect(render()).not.toContain("Registered twice by mistake");
  });

  test("offers correction only for a correctable sale and shows the busy cursor", () => {
    const markup = render();
    expect(markup.split(rowActions).length - 1).toBe(1);
    expect(markup).toContain(t("common.loadingMore"));
    expect(markup).toContain('aria-busy="true"');
  });

  test("withdraws correction and pagination the state does not allow", () => {
    const markup = render({
      state: {
        kind: "ready",
        items: [sale],
        canCorrect: false,
        hasMore: false,
        loadingMore: false,
        stale: true,
        queriedAt: timestamp,
      },
    });
    expect(markup).not.toContain(rowActions);
    expect(markup).not.toContain(`>${t("common.loadMore")}<`);
    expect(markup).toContain(t("sales.list.queriedAt", { date: "" }).trim());
  });

  test("hides the filter on denial and keeps a failed read distinct from an empty history", () => {
    const denied = render({ state: { kind: "denied" } });
    expect(denied).toContain(t("sales.list.deniedTitle"));
    expect(denied).not.toContain(filterGroup);
    const failed = render({ state: { kind: "error" } });
    expect(failed).toContain(t("sales.list.unavailableTitle"));
    expect(failed).toContain(filterGroup);
    expect(failed).not.toContain(t("sales.list.emptyTitle"));
    const loading = render({ state: { kind: "loading" } });
    expect(loading).toContain(t("sales.list.loading"));
    expect(loading).not.toContain("$12.50");
  });

  test("offers registering from an empty history only with the permission", () => {
    const state = { kind: "empty", queriedAt: timestamp, stale: false } as const;
    const allowed = render({ state });
    expect(allowed).toContain(t("sales.list.emptyTitle"));
    expect(allowed).toContain(t("sales.register"));
    expect(allowed).toContain("/operate/sales/new");
    const readOnly = render({ canCreate: false, state });
    expect(readOnly).toContain(t("sales.list.emptyTitle"));
    expect(readOnly).not.toContain(t("sales.register"));
  });

  test("names the filter that emptied the history and offers every sale back", () => {
    const markup = render({
      filter: "voided",
      state: { kind: "empty", queriedAt: timestamp, stale: false },
    });
    expect(markup).toContain(t("sales.list.emptyVoidedTitle"));
    expect(markup).toContain(t("sales.list.showAll"));
    expect(markup).not.toContain(t("sales.register"));
  });
});
