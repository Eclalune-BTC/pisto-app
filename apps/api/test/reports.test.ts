import { describe, expect, test } from "bun:test";
import type { Auth } from "@pisto/auth";
import type { OperatingReport } from "@pisto/contracts";
import type { ReportsRepository } from "@pisto/db";
import { ProductError } from "@pisto/db";
import { Hono } from "hono";
import { normalizeError } from "../src/errors.ts";
import { reportsRoutes } from "../src/routes/reports.ts";
import type { AppEnv } from "../src/types.ts";

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

function createTestApp(
  getOperatingReport: ReportsRepository["getOperatingReport"],
  authenticated = true,
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
  const app = new Hono<AppEnv>();
  app.route("/v1", reportsRoutes({ auth, reports: { getOperatingReport } }));
  // Mirrors the single boundary in src/app.ts so a router mounted on its own
  // still translates a domain failure exactly as the composed application does.
  app.onError((error, context) => {
    const { apiError } = normalizeError(error);
    return context.json(
      {
        error: {
          code: apiError.code,
          message: apiError.message,
          requestId: "request_test",
        },
      },
      apiError.status,
    );
  });
  return app;
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

  test("ignores a client-supplied tenant instead of forwarding it", async () => {
    let received: unknown;
    const response = await createTestApp(async (actor, query) => {
      received = { actor, query };
      return report;
    }).request(`/v1/reports/operating?${validRange}&businessId=untrusted`);

    expect(response.status).toBe(200);
    expect(received).toEqual({
      actor: {
        userId: "user_test",
        sessionId: "session_test",
        activeBusinessId: "business_test",
      },
      query: { startLocalDate: "2026-08-01", endLocalDate: "2026-08-22" },
    });
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
