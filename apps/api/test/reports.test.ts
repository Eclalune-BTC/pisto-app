import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { CashFlowReport, OperatingReport } from "@pisto/contracts";
import type { ReportsRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { reportsRoutes } from "../src/routes/reports.ts";
import { testAccess, testClient, testErrorBoundary } from "./http-client.ts";

const report: OperatingReport = {
  period: {
    startLocalDate: "2026-08-01",
    endLocalDateInclusive: "2026-08-22",
    startUtc: "2026-08-01T06:00:00.000Z",
    endUtcExclusive: "2026-08-23T06:00:00.000Z",
    timeZone: "America/El_Salvador",
  },
  positionAsOfLocalDate: "2026-08-22",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  sales: { grossMinorUnits: "0", saleCount: "0" },
  expenses: { totalMinorUnits: "0", expenseCount: "0", categories: [] },
  cash: {
    inflowMinorUnits: "0",
    outflowMinorUnits: "0",
    netMovementMinorUnits: "0",
    accounts: [],
  },
  inventory: { trackedProductCount: "0", lowStockProductCount: "0" },
  receivables: {
    outstandingMinorUnits: "0",
    overdueMinorUnits: "0",
    openReceivableCount: "0",
    overdueReceivableCount: "0",
  },
  queriedAt: "2026-08-22T18:00:00.000Z",
};

const validRange = "startLocalDate=2026-08-01&endLocalDate=2026-08-22";

const cashFlow: CashFlowReport = {
  timeZone: "America/El_Salvador",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  asOfLocalDate: "2026-08-22",
  months: [
    {
      month: "2026-08",
      inflowMinorUnits: "1500",
      outflowMinorUnits: "500",
      netMinorUnits: "1000",
      closingBalanceMinorUnits: "4000",
    },
  ],
  queriedAt: "2026-08-22T18:00:00.000Z",
};

const unusedCashFlow: ReportsRepository["getCashFlowReport"] = async () => {
  throw new Error("The cash flow report was not expected in this test");
};

function createTestApp(
  getOperatingReport: ReportsRepository["getOperatingReport"],
  authenticated = true,
  getCashFlowReport: ReportsRepository["getCashFlowReport"] = unusedCashFlow,
) {
  const auth = {
    api: {
      getSession: async () =>
        authenticated
          ? {
              user: { id: "user_test" },
              session: {
                id: "session_test",
                activeOrganizationId: "business_test",
                expiresAt: new Date(Date.now() + 60_000),
              },
            }
          : null,
    },
  } as unknown as Auth;
  return testClient(
    testErrorBoundary().use(
      reportsRoutes({
        access: testAccess(auth),
        reports: { getCashFlowReport, getOperatingReport },
      }),
    ),
  );
}

describe("operating report route", () => {
  test("requires authentication before the report repository is called", async () => {
    let called = false;
    const response = await createTestApp(async () => {
      called = true;
      return report;
    }, false).request(`/v1/reports/operating?${validRange}`);

    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });

  test("passes the bounded range and a server-derived actor", async () => {
    let received: unknown;
    const response = await createTestApp(async (actor, query) => {
      received = { actor, query };
      return report;
    }).request(`/v1/reports/operating?${validRange}`);

    expect(response.status).toBe(200);
    expect(received).toEqual({
      actor: {
        userId: "user_test",
        sessionId: "session_test",
        activeBusinessId: "business_test",
      },
      query: { startLocalDate: "2026-08-01", endLocalDate: "2026-08-22" },
    });
    expect(await response.json()).toEqual({ data: { report } });
  });

  test("rejects a client-supplied tenant instead of ignoring it", async () => {
    let called = false;
    const response = await createTestApp(async () => {
      called = true;
      return report;
    }).request(`/v1/reports/operating?${validRange}&businessId=untrusted`);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "Operating report range is invalid" },
    });
    expect(called).toBe(false);
  });

  test.each([
    "",
    "startLocalDate=2026-08-01",
    "startLocalDate=2026-02-29&endLocalDate=2026-03-01",
    "startLocalDate=2026-08-22&endLocalDate=2026-08-01",
    "startLocalDate=2025-01-01&endLocalDate=2026-01-02",
  ])("rejects a range the contract does not accept: %s", async (query) => {
    let called = false;
    const response = await createTestApp(async () => {
      called = true;
      return report;
    }).request(`/v1/reports/operating?${query}`);

    expect(response.status).toBe(400);
    expect(called).toBe(false);
    expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
  });

  test("translates a fresh permission denial without leaking report data", async () => {
    const response = await createTestApp(async () => {
      throw new ProductError("FORBIDDEN", "Reports require elevated access");
    }).request(`/v1/reports/operating?${validRange}`);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: { code: "FORBIDDEN", message: "Reports require elevated access" },
    });
  });

  test("does not turn a query failure into a successful zero report", async () => {
    const response = await createTestApp(async () => {
      throw new Error("database snapshot failed");
    }).request(`/v1/reports/operating?${validRange}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
        requestId: "request_test",
      },
    });
  });
});

describe("cash flow report route", () => {
  const unusedOperating: ReportsRepository["getOperatingReport"] = async () => report;

  test("passes the requested months and a server-derived actor", async () => {
    let received: unknown;
    const response = await createTestApp(unusedOperating, true, async (actor, query) => {
      received = { actor, query };
      return cashFlow;
    }).request("/v1/reports/cash-flow?endMonth=2026-08&months=6");

    expect(response.status).toBe(200);
    expect(received).toEqual({
      actor: {
        userId: "user_test",
        sessionId: "session_test",
        activeBusinessId: "business_test",
      },
      query: { endMonth: "2026-08", months: 6 },
    });
    expect(await response.json()).toEqual({ data: { report: cashFlow } });
  });

  test.each(["", "endMonth=2026-13", "endMonth=2026-08&months=13", "endMonth=2026-08&months=0"])(
    "rejects months the contract does not accept: %s",
    async (query) => {
      let called = false;
      const response = await createTestApp(unusedOperating, true, async () => {
        called = true;
        return cashFlow;
      }).request(`/v1/reports/cash-flow?${query}`);
      expect(response.status).toBe(400);
      expect(called).toBe(false);
    },
  );

  test("requires authentication before the repository is called", async () => {
    let called = false;
    const response = await createTestApp(unusedOperating, false, async () => {
      called = true;
      return cashFlow;
    }).request("/v1/reports/cash-flow?endMonth=2026-08");
    expect(response.status).toBe(401);
    expect(called).toBe(false);
  });
});
