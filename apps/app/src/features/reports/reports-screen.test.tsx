import type { OperatingReport } from "@pisto/contracts";
import { type ComponentProps, createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("uniwind", () => ({
  useUniwind: () => ({ theme: "light" }),
  useCSSVariable: (names: string | string[]) =>
    Array.isArray(names) ? names.map(() => "#1c1917") : "#1c1917",
  withUniwind: (component: unknown) => component,
}));
vi.mock("@rn-primitives/slot", () => ({ Slot: () => null }));
vi.mock("expo-localization", () => ({ getLocales: () => [{ languageTag: "es-SV" }] }));
// Tone and variant are styling decisions; expose them as attributes so the markup can be read.
vi.mock("@/components/layout/stat-group", () => ({
  StatGroup: ({ children }: { children: ReactNode }) => createElement("dl", {}, children),
  Stat: ({ detail, label, tone = "default", value }: Record<string, string>) =>
    createElement("div", { "data-stat": label, "data-tone": tone }, `${value} | ${detail}`),
}));
vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children, role, variant }: { children: ReactNode; role?: string; variant?: string }) =>
    createElement("div", { "data-variant": variant, role: role ?? "alert" }, children),
  AlertDescription: ({ children }: { children: ReactNode }) => createElement("p", {}, children),
}));

import { i18n } from "@/i18n/config";
import { ReportsScreen } from "./reports-screen";

const t = i18n.t;

const report = {
  period: {
    startLocalDate: "2026-09-01",
    endLocalDateInclusive: "2026-09-30",
    startUtc: "2026-09-01T06:00:00.000Z",
    endUtcExclusive: "2026-10-01T06:00:00.000Z",
    timeZone: "America/El_Salvador",
  },
  positionAsOfLocalDate: "2026-10-04",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  sales: { grossMinorUnits: "1234550", saleCount: "18" },
  expenses: {
    totalMinorUnits: "40000",
    expenseCount: "3",
    categories: [
      { category: "rent", totalMinorUnits: "10000", expenseCount: "1" },
      { category: "inventory", totalMinorUnits: "30000", expenseCount: "2" },
    ],
  },
  cash: {
    inflowMinorUnits: "900000",
    outflowMinorUnits: "40000",
    netMovementMinorUnits: "860000",
    accounts: [
      {
        accountId: "11111111-1111-4111-8111-111111111111",
        accountName: "Caja principal",
        accountKind: "cash",
        accountStatus: "active",
        inflowMinorUnits: "900000",
        outflowMinorUnits: "40000",
        netMovementMinorUnits: "860000",
      },
      {
        accountId: "22222222-2222-4222-8222-222222222222",
        accountName: "Cuenta cerrada",
        accountKind: "bank",
        accountStatus: "archived",
        inflowMinorUnits: "0",
        outflowMinorUnits: "0",
        netMovementMinorUnits: "0",
      },
    ],
  },
  inventory: { trackedProductCount: "14", lowStockProductCount: "2" },
  receivables: {
    outstandingMinorUnits: "70000",
    overdueMinorUnits: "50000",
    openReceivableCount: "3",
    overdueReceivableCount: "1",
  },
  queriedAt: "2026-10-04T18:00:00.000Z",
} satisfies OperatingReport;

const quiet: OperatingReport = {
  ...report,
  sales: { grossMinorUnits: "0", saleCount: "0" },
  expenses: { totalMinorUnits: "0", expenseCount: "0", categories: [] },
  cash: {
    inflowMinorUnits: "0",
    outflowMinorUnits: "0",
    netMovementMinorUnits: "0",
    accounts: report.cash.accounts.map((account) => ({
      ...account,
      inflowMinorUnits: "0",
      outflowMinorUnits: "0",
      netMovementMinorUnits: "0",
    })),
  },
  receivables: { ...report.receivables, overdueMinorUnits: "0", overdueReceivableCount: "0" },
  inventory: { trackedProductCount: "14", lowStockProductCount: "0" },
};

function render(overrides: Partial<ComponentProps<typeof ReportsScreen>> = {}) {
  const onApply = vi.fn();
  const props: ComponentProps<typeof ReportsScreen> = {
    links: { cashAccounts: true, inventory: true, receivables: true },
    locale: "es-SV",
    onRetry: vi.fn(),
    range: {
      dirty: false,
      endLocalDate: "2026-09-30",
      issue: null,
      onApply,
      onEndLocalDateChange: vi.fn(),
      onPresetChange: vi.fn(),
      onStartLocalDateChange: vi.fn(),
      preset: "lastMonth",
      startLocalDate: "2026-09-01",
    },
    retrying: false,
    state: { isStale: false, kind: "ready", report },
    ...overrides,
  };
  return renderToStaticMarkup(createElement(ReportsScreen, props));
}

describe("operating report screen", () => {
  test.each(["loading", "error", "offline"] as const)(
    "keeps report dates editable during %s without manufacturing report data",
    (kind) => {
      const markup = render({
        state: kind === "loading" ? { kind } : { kind, message: "The query is unavailable." },
      });
      expect(markup).toContain('value="2026-09-01"');
      expect(markup).toContain('value="2026-09-30"');
      expect(markup).not.toContain(`data-stat="${t("reports.period.sales")}"`);
      expect(markup).not.toContain("$12,345.50");
    },
  );

  test("hides the range and every figure when report access is denied", () => {
    const markup = render({ state: { kind: "denied" } });
    expect(markup).toContain(t("reports.deniedTitle"));
    expect(markup).not.toContain('value="2026-09-01"');
    expect(markup).not.toContain("data-stat");
  });

  test("shows the exact period figures apart from the dated current position", () => {
    const markup = render();
    expect(markup).toContain(`data-stat="${t("reports.period.sales")}"`);
    expect(markup).toContain("$12,345.50 | 18 ventas");
    expect(markup).toContain("$400.00 | 3 gastos");
    expect(markup).toContain("$8,600.00 | Entradas $9,000.00 · Salidas $400.00");
    expect(markup).toContain(t("reports.position.asOf", { date: "4 oct 2026" }));
    expect(markup).toContain("$700.00 | 3 cuentas abiertas");
    // Largest category first, with its share of the period total.
    expect(markup.indexOf("Inventario")).toBeLessThan(markup.indexOf("Alquiler"));
    expect(markup).toContain("75.0%");
    expect(markup).toContain("Cuenta cerrada");
    expect(markup).toContain(t("cash.accountStatus.archived"));
    // The cash figures say what they include, since they cannot reconcile with sales.
    expect(markup).toContain(t("reports.period.cashScope"));
  });

  test("links accounts and positions only to modules the role can open", () => {
    const linked = render();
    expect(linked).toContain('href="/operate/receivables"');
    expect(linked).toContain('href="/operate/inventory"');
    expect(linked).toContain("/operate/cash/accounts/[accountId]");
    const plain = render({ links: { cashAccounts: false, inventory: false, receivables: false } });
    expect(plain).not.toContain('href="/operate/receivables"');
    expect(plain).not.toContain('href="/operate/inventory"');
    expect(plain).not.toContain("/operate/cash/accounts/");
    expect(plain).toContain("Caja principal");
  });

  test("colors an overdue amount and low stock only when they are above zero", () => {
    const tone = (markup: string, label: string) =>
      markup.match(new RegExp(`data-stat="${label}" data-tone="([a-z]+)"`))?.[1];
    const busy = render();
    expect(tone(busy, t("reports.position.overdue"))).toBe("warning");
    expect(tone(busy, t("reports.position.lowStock"))).toBe("warning");
    const calm = render({ state: { isStale: false, kind: "ready", report: quiet } });
    expect(tone(calm, t("reports.position.overdue"))).toBe("default");
    expect(tone(calm, t("reports.position.lowStock"))).toBe("default");
    expect(tone(calm, t("reports.period.netCash"))).toBe("default");
  });

  test("states a period without activity as a neutral note, not a success", () => {
    const markup = render({ state: { isStale: false, kind: "ready", report: quiet } });
    expect(markup).toContain(
      `<div data-variant="default" role="note"><p>${t("reports.period.noActivity")}</p></div>`,
    );
    expect(markup).not.toContain('data-variant="positive"');
    expect(render()).not.toContain(t("reports.period.noActivity"));
  });

  test("keeps cached figures visible but labelled when they could not be refreshed", () => {
    const markup = render({ state: { isStale: true, kind: "ready", report } });
    expect(markup).toContain(t("remote.stale"));
    expect(markup).toContain("$12,345.50");
  });

  test("names the field problem once for the pair of dates", () => {
    const markup = render({
      range: {
        dirty: true,
        endLocalDate: "2026-09-01",
        issue: "reversed",
        onApply: vi.fn(),
        onEndLocalDateChange: vi.fn(),
        onPresetChange: vi.fn(),
        onStartLocalDateChange: vi.fn(),
        preset: "custom",
        startLocalDate: "2026-09-30",
      },
    });
    expect(markup.split(t("reports.range.reversed"))).toHaveLength(2);
  });
});
