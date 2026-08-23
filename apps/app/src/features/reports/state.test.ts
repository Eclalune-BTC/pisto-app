import type { OperatingReport } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

import { ApiClientError } from "@/lib/api-error";

import { reportsScreenState } from "./state";

const messages = { offlineMessage: "sin conexión", unavailableMessage: "no disponible" };

const report = {
  period: {
    startLocalDate: "2026-03-01",
    endLocalDateInclusive: "2026-03-31",
    startUtc: "2026-03-01T06:00:00.000Z",
    endUtcExclusive: "2026-04-01T06:00:00.000Z",
    timeZone: "America/El_Salvador",
  },
  positionAsOfLocalDate: "2026-03-31",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  sales: { grossMinorUnits: "12500", saleCount: "2" },
  expenses: { totalMinorUnits: "1000", expenseCount: "2", categories: [] },
  cash: {
    inflowMinorUnits: "5400",
    outflowMinorUnits: "2600",
    netMovementMinorUnits: "2800",
    accounts: [],
  },
  inventory: { trackedProductCount: "3", lowStockProductCount: "1" },
  receivables: {
    outstandingMinorUnits: "7000",
    overdueMinorUnits: "5000",
    openReceivableCount: "2",
    overdueReceivableCount: "1",
  },
  queriedAt: "2026-03-31T18:00:00.000Z",
} satisfies OperatingReport;

function businessesQuery(
  overrides: Partial<Parameters<typeof reportsScreenState>[0]["businesses"]>,
) {
  return {
    data: { items: [] } as unknown,
    error: null as unknown,
    fetchStatus: "idle" as "fetching" | "paused" | "idle",
    isError: false,
    isPending: false,
    ...overrides,
  };
}

function reportQuery(overrides: Partial<Parameters<typeof reportsScreenState>[0]["report"]>) {
  return {
    data: undefined as { report: OperatingReport } | undefined,
    error: null as unknown,
    fetchStatus: "idle" as "fetching" | "paused" | "idle",
    isError: false,
    isPending: false,
    ...overrides,
  };
}

function screenState(
  overrides: Partial<Pick<Parameters<typeof reportsScreenState>[0], "businesses" | "report">> & {
    canRead?: boolean;
  } = {},
) {
  return reportsScreenState({
    businesses: overrides.businesses ?? businessesQuery({}),
    canRead: overrides.canRead ?? true,
    report: overrides.report ?? reportQuery({ data: { report } }),
    ...messages,
  });
}

describe("operating report screen state", () => {
  test("reports the failure instead of a zeroed report when the query fails", () => {
    expect(
      screenState({ report: reportQuery({ isError: true, error: new Error("boom") }) }),
    ).toEqual({ kind: "error", message: "no disponible" });
  });

  test("names the failure offline when the read is paused for connectivity", () => {
    expect(
      screenState({ report: reportQuery({ fetchStatus: "paused", isPending: true }) }),
    ).toEqual({ kind: "offline", message: "sin conexión" });
  });

  test("denies a report the membership may not read without querying it", () => {
    expect(screenState({ canRead: false, report: reportQuery({ isPending: true }) })).toEqual({
      kind: "denied",
    });
    expect(
      screenState({
        report: reportQuery({
          error: new ApiClientError("Reports require elevated access", 403, "FORBIDDEN"),
          isError: true,
        }),
      }),
    ).toEqual({ kind: "denied" });
  });

  test("marks a report that could not be refreshed as stale", () => {
    expect(screenState({ report: reportQuery({ data: { report }, isError: true }) })).toEqual({
      isStale: true,
      kind: "ready",
      report,
    });
    expect(
      screenState({
        businesses: businessesQuery({ isError: true }),
        report: reportQuery({ data: { report } }),
      }),
    ).toMatchObject({ isStale: true, kind: "ready" });
  });

  test("keeps loading until the report itself arrives", () => {
    expect(screenState({ report: reportQuery({ isPending: true }) })).toEqual({ kind: "loading" });
    expect(
      screenState({ businesses: businessesQuery({ isPending: true, data: undefined }) }),
    ).toEqual({ kind: "loading" });
  });

  test("exposes the report unchanged once both reads succeed", () => {
    expect(screenState()).toEqual({ isStale: false, kind: "ready", report });
  });
});
