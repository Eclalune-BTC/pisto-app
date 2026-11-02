import type { CashFlowReport, OperatingReport } from "@pisto/contracts";
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
vi.mock("./cash-flow-chart", () => ({ CashFlowChart: () => null }));
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

const cashFlow: CashFlowReport = {
  timeZone: "America/El_Salvador",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  asOfLocalDate: "2026-10-04",
  months: [
    {
      month: "2026-09",
      inflowMinorUnits: "900000",
      outflowMinorUnits: "40000",
      netMinorUnits: "860000",
      closingBalanceMinorUnits: "1000000",
    },
    {
      month: "2026-10",
      inflowMinorUnits: "0",
      outflowMinorUnits: "25000",
      netMinorUnits: "-25000",
      closingBalanceMinorUnits: "975000",
    },
  ],
  queriedAt: "2026-10-04T18:00:00.000Z",
};

type CashFlowQuery = ComponentProps<typeof ReportsScreen>["cashFlow"];
const cashFlowReady: CashFlowQuery = {
  data: { report: cashFlow },
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
};

function render(overrides: Partial<ComponentProps<typeof ReportsScreen>> = {}) {
  const props: ComponentProps<typeof ReportsScreen> = {
    cashFlow: cashFlowReady,
    locale: "es-SV",
    month: { month: "2026-09", onNext: vi.fn(), onPrevious: vi.fn() },
    onRetry: vi.fn(),
    retrying: false,
    state: { isStale: false, kind: "ready", report },
    ...overrides,
  };
  return renderToStaticMarkup(createElement(ReportsScreen, props));
}

describe("monthly report screen", () => {
  test.each(["loading", "error", "offline"] as const)(
    "keeps the month navigator during %s without manufacturing report data",
    (kind) => {
      const markup = render({
        state: kind === "loading" ? { kind } : { kind, message: "The query is unavailable." },
      });
      expect(markup).toContain("Septiembre de 2026");
      expect(markup).toContain(`aria-label="${t("reports.month.previous")}"`);
      expect(markup).not.toContain("$12,345.50");
      expect(markup).not.toContain(t("reports.statement.title"));
    },
  );

  test("hides the navigator and every figure when report access is denied", () => {
    const markup = render({ state: { kind: "denied" } });
    expect(markup).toContain(t("reports.deniedTitle"));
    expect(markup).not.toContain("Septiembre de 2026");
    expect(markup).not.toContain("$12,345.50");
    expect(markup).not.toContain("$10,000.00");
  });

  test("states sales, each expense category and sales less expenses exactly", () => {
    const markup = render();
    expect(markup).toContain("$12,345.50");
    expect(markup).toContain("18 ventas");
    expect(markup).toContain(`${t("expenses.categories.inventory")} · 75.0`);
    expect(markup).toContain("−$300.00");
    expect(markup).toContain("−$100.00");
    expect(markup).toContain("−$400.00");
    expect(markup).toContain(t("reports.statement.result"));
    expect(markup).toContain("$11,945.50");
    expect(markup).toContain("96.8");
  });

  test("lists every cash flow month with its closing balance and the month in progress", () => {
    const markup = render();
    expect(markup).toContain("Septiembre");
    expect(markup).toContain(t("reports.cashFlow.monthToDate", { day: 4, month: "Octubre" }));
    expect(markup).toContain("$9,000.00");
    expect(markup).toContain("$10,000.00");
    expect(markup).toContain("$9,750.00");
  });

  test("keeps the statement when only the cash flow read fails", () => {
    const markup = render({
      cashFlow: { data: undefined, isError: true, isFetching: false, refetch: vi.fn() },
    });
    expect(markup).toContain("$12,345.50");
    expect(markup).toContain(t("reports.cashFlow.unavailableTitle"));
    expect(markup).not.toContain("$9,750.00");
  });

  test("states a month without activity as a neutral note, not a success", () => {
    const markup = render({ state: { isStale: false, kind: "ready", report: quiet } });
    expect(markup).toContain(t("reports.statement.noActivity"));
    expect(render()).not.toContain(t("reports.statement.noActivity"));
  });

  test("disables the next month while the current month is shown", () => {
    const markup = render({ month: { month: "2026-10", onPrevious: vi.fn() } });
    expect(markup).toMatch(
      new RegExp(
        `aria-disabled="true"[^>]*aria-label="${t("reports.month.next")}"|aria-label="${t("reports.month.next")}"[^>]*aria-disabled="true"`,
      ),
    );
  });

  test("keeps cached figures visible but labelled when they could not be refreshed", () => {
    const markup = render({ state: { isStale: true, kind: "ready", report } });
    expect(markup).toContain(t("remote.stale"));
    expect(markup).toContain("$12,345.50");
  });
});
