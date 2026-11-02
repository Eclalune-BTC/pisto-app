import type { OperatingReport } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

import {
  barHeights,
  expenseCategoryShares,
  formatCount,
  formatShare,
  hasPeriodActivity,
  resultOfSales,
} from "./report-figures";

const account = {
  accountId: "11111111-1111-4111-8111-111111111111",
  accountName: "Caja",
  accountKind: "cash",
  accountStatus: "active",
  inflowMinorUnits: "0",
  outflowMinorUnits: "0",
  netMovementMinorUnits: "0",
} satisfies OperatingReport["cash"]["accounts"][number];

const quietReport = {
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
  sales: { grossMinorUnits: "0", saleCount: "0" },
  expenses: { totalMinorUnits: "0", expenseCount: "0", categories: [] },
  cash: {
    inflowMinorUnits: "0",
    outflowMinorUnits: "0",
    netMovementMinorUnits: "0",
    accounts: [account],
  },
  inventory: { trackedProductCount: "4", lowStockProductCount: "1" },
  receivables: {
    outstandingMinorUnits: "2500",
    overdueMinorUnits: "0",
    openReceivableCount: "1",
    overdueReceivableCount: "0",
  },
  queriedAt: "2026-10-04T18:00:00.000Z",
} satisfies OperatingReport;

describe("period activity", () => {
  test("a period without published flows has no activity even while positions are open", () => {
    expect(hasPeriodActivity(quietReport)).toBe(false);
  });

  test("any sale, expense or account movement is activity, including an internal transfer", () => {
    expect(
      hasPeriodActivity({ ...quietReport, sales: { grossMinorUnits: "100", saleCount: "1" } }),
    ).toBe(true);
    expect(
      hasPeriodActivity({
        ...quietReport,
        expenses: { ...quietReport.expenses, expenseCount: "1", totalMinorUnits: "100" },
      }),
    ).toBe(true);
    // A transfer moves both accounts but leaves the business inflow and outflow at zero.
    expect(
      hasPeriodActivity({
        ...quietReport,
        cash: {
          ...quietReport.cash,
          accounts: [
            { ...account, outflowMinorUnits: "500", netMovementMinorUnits: "-500" },
            {
              ...account,
              accountId: "22222222-2222-4222-8222-222222222222",
              inflowMinorUnits: "500",
              netMovementMinorUnits: "500",
            },
          ],
        },
      }),
    ).toBe(true);
  });
});

describe("expense category shares", () => {
  test("orders categories by exact amount and rounds each share half up to a tenth", () => {
    const shares = expenseCategoryShares({
      totalMinorUnits: "9007199254740993",
      expenseCount: "4",
      categories: [
        { category: "rent", totalMinorUnits: "1", expenseCount: "1" },
        { category: "inventory", totalMinorUnits: "9007199254740991", expenseCount: "2" },
        { category: "tax", totalMinorUnits: "1", expenseCount: "1" },
      ],
    });
    expect(shares.map(({ category }) => category)).toEqual(["inventory", "rent", "tax"]);
    expect(shares.map(({ shareTenths }) => shareTenths)).toEqual([1000, 0, 0]);
    expect(formatShare(shares[0] as (typeof shares)[number], "es-SV")).toBe("100.0%");
    // A real but tiny amount never reads as nothing.
    expect(formatShare(shares[1] as (typeof shares)[number], "es-SV")).toBe("<0.1%");
  });

  test("keeps tied categories in the server order", () => {
    const shares = expenseCategoryShares({
      totalMinorUnits: "3000",
      expenseCount: "3",
      categories: [
        { category: "rent", totalMinorUnits: "1000", expenseCount: "1" },
        { category: "utilities", totalMinorUnits: "1000", expenseCount: "1" },
        { category: "other", totalMinorUnits: "1000", expenseCount: "1" },
      ],
    });
    expect(shares.map(({ category, shareTenths }) => [category, shareTenths])).toEqual([
      ["rent", 333],
      ["utilities", 333],
      ["other", 333],
    ]);
  });

  test("rounds a half tenth up", () => {
    const [share] = expenseCategoryShares({
      totalMinorUnits: "2000",
      expenseCount: "2",
      categories: [
        { category: "rent", totalMinorUnits: "1001", expenseCount: "1" },
        { category: "tax", totalMinorUnits: "999", expenseCount: "1" },
      ],
    });
    expect(share?.shareTenths).toBe(501);
  });
});

describe("counts", () => {
  test("format beyond the safe integer range without rounding", () => {
    expect(formatCount("9007199254740993", "es-SV")).toBe("9,007,199,254,740,993");
    expect(formatCount("0", "es-SV")).toBe("0");
  });
});

describe("sales less expenses", () => {
  const withFigures = (sales: string, expenses: string) => ({
    ...quietReport,
    sales: { grossMinorUnits: sales, saleCount: "1" },
    expenses: { totalMinorUnits: expenses, expenseCount: "1", categories: [] },
  });

  test("subtracts exactly and rounds the share of sales half away from zero", () => {
    expect(resultOfSales(withFigures("1394000", "104520"))).toEqual({
      minorUnits: "1289480",
      shareTenths: 925,
      sign: 1,
    });
    expect(resultOfSales(withFigures("2000", "2001"))).toEqual({
      minorUnits: "-1",
      shareTenths: -1,
      sign: -1,
    });
  });

  test("has no share of sales without sales", () => {
    expect(resultOfSales(withFigures("0", "500"))).toEqual({
      minorUnits: "-500",
      shareTenths: null,
      sign: -1,
    });
    expect(resultOfSales(quietReport).sign).toBe(0);
  });
});

describe("cash flow bars", () => {
  test("scale against the largest movement and keep small movements visible", () => {
    expect(
      barHeights(
        [
          { inflowMinorUnits: "100000", outflowMinorUnits: "50000" },
          { inflowMinorUnits: "1", outflowMinorUnits: "0" },
        ],
        144,
      ),
    ).toEqual([
      { inflow: 144, outflow: 72 },
      { inflow: 2, outflow: 0 },
    ]);
  });

  test("draw nothing for months without movements", () => {
    expect(barHeights([{ inflowMinorUnits: "0", outflowMinorUnits: "0" }], 144)).toEqual([
      { inflow: 0, outflow: 0 },
    ]);
  });
});
