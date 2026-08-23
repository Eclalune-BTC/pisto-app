import { operatingReportQuerySchema, operatingReportResponseSchema } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

describe("operating report contracts", () => {
  test("accepts one inclusive calendar year, including leap day", () => {
    expect(
      operatingReportQuerySchema.safeParse({
        startLocalDate: "2024-01-01",
        endLocalDate: "2024-12-31",
      }).success,
    ).toBe(true);
  });

  test.each([
    { startLocalDate: "2026-02-29", endLocalDate: "2026-03-01" },
    { startLocalDate: "2026-04-02", endLocalDate: "2026-04-01" },
    { startLocalDate: "2025-01-01", endLocalDate: "2026-01-02" },
  ])("rejects invalid or unbounded ranges: $startLocalDate to $endLocalDate", (query) => {
    expect(operatingReportQuerySchema.safeParse(query).success).toBe(false);
  });

  test("keeps period flows separate from current positions", () => {
    const parsed = operatingReportResponseSchema.parse({
      data: {
        report: {
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
        },
      },
    });

    expect(parsed.data.report.positionAsOfLocalDate).toBe("2026-08-22");
    expect(parsed.data.report.sales.grossMinorUnits).toBe("0");
  });
});
