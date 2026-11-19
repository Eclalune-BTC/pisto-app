import { describe, expect, test } from "bun:test";
import type {
  BusinessPeriod,
  Debtors,
  MoneyTrend,
  OperatingReport,
  OperatingReportQuery,
  PayablesSummaryResponse,
  Product,
  ReceivablesSummary,
  SalesPeriodSummary,
} from "@pisto/contracts";

import { answerBusinessQuestion, type BusinessFacts, periodRange } from "../src/index.ts";

type Actor = { userId: string };
const actor: Actor = { userId: "user_test" };
const scope = {
  currency: "USD",
  currencyMinorUnitDigits: 2,
  queriedAt: "2026-11-04T15:00:00.000Z",
};

describe("periods", () => {
  // 2026-11-04 is a Wednesday.
  test.each([
    ["today", "2026-11-04", "2026-11-04"],
    ["yesterday", "2026-11-03", "2026-11-03"],
    ["this_week", "2026-11-02", "2026-11-04"],
    ["last_week", "2026-10-26", "2026-11-01"],
    ["this_month", "2026-11-01", "2026-11-04"],
    ["last_month", "2026-10-01", "2026-10-31"],
    ["last_7_days", "2026-10-29", "2026-11-04"],
    ["last_30_days", "2026-10-06", "2026-11-04"],
  ] as const)("%s runs from %s to %s", (period, startLocalDate, endLocalDate) => {
    expect(periodRange(period, "2026-11-04")).toEqual({ startLocalDate, endLocalDate });
  });

  test("a week starts on Monday, also when today is Sunday or Monday", () => {
    expect(periodRange("this_week", "2026-11-08")).toEqual({
      startLocalDate: "2026-11-02",
      endLocalDate: "2026-11-08",
    });
    expect(periodRange("this_week", "2026-11-09")).toEqual({
      startLocalDate: "2026-11-09",
      endLocalDate: "2026-11-09",
    });
    expect(periodRange("last_week", "2026-11-09")).toEqual({
      startLocalDate: "2026-11-02",
      endLocalDate: "2026-11-08",
    });
  });

  test("crosses a year and a leap day", () => {
    expect(periodRange("last_month", "2027-01-15")).toEqual({
      startLocalDate: "2026-12-01",
      endLocalDate: "2026-12-31",
    });
    expect(periodRange("last_month", "2028-03-10")).toEqual({
      startLocalDate: "2028-02-01",
      endLocalDate: "2028-02-29",
    });
    expect(periodRange("last_7_days", "2027-01-03")).toEqual({
      startLocalDate: "2026-12-28",
      endLocalDate: "2027-01-03",
    });
  });
});

const sales: SalesPeriodSummary = {
  grossMinorUnits: "9750",
  saleCount: "3",
  averageMinorUnits: "3250",
  itemizedSaleCount: "2",
  topProducts: [
    {
      productId: "10000000-0000-4000-8000-000000000001",
      name: "Café molido 1 lb",
      unitKind: "unit",
      quantityPrecision: 0,
      quantityMinorUnits: "6",
      grossMinorUnits: "1950",
    },
  ],
  businessLocalDate: "2026-11-04",
  ...scope,
};

const report = (range: OperatingReportQuery): OperatingReport => ({
  period: {
    startLocalDate: range.startLocalDate,
    endLocalDateInclusive: range.endLocalDate,
    startUtc: "2026-11-01T06:00:00.000Z",
    endUtcExclusive: "2026-11-05T06:00:00.000Z",
    timeZone: "America/El_Salvador",
  },
  positionAsOfLocalDate: "2026-11-04",
  sales: { grossMinorUnits: "9750", saleCount: "3" },
  expenses: {
    totalMinorUnits: "7400",
    expenseCount: "2",
    categories: [
      { category: "utilities", totalMinorUnits: "6400", expenseCount: "1" },
      { category: "transport", totalMinorUnits: "1000", expenseCount: "1" },
    ],
  },
  cash: {
    inflowMinorUnits: "8000",
    outflowMinorUnits: "7400",
    netMovementMinorUnits: "600",
    accounts: [],
  },
  inventory: { trackedProductCount: "12", lowStockProductCount: "2" },
  receivables: {
    outstandingMinorUnits: "8160",
    overdueMinorUnits: "4195",
    openReceivableCount: "5",
    overdueReceivableCount: "2",
  },
  ...scope,
});

const trend: MoneyTrend = {
  range: "7d",
  startLocalDate: "2026-10-29",
  endLocalDate: "2026-11-04",
  timeZone: "America/El_Salvador",
  activeAccountCount: "2",
  openingMinorUnits: "200000",
  closingMinorUnits: "233193",
  changeMinorUnits: "33193",
  points: [{ localDate: "2026-11-04", closingMinorUnits: "233193" }],
  kinds: [
    { kind: "cash", accountCount: "1", balanceMinorUnits: "14180" },
    { kind: "bank", accountCount: "1", balanceMinorUnits: "219013" },
  ],
  ...scope,
};

const receivables = {
  outstandingMinorUnits: "8160",
  overdueMinorUnits: "4195",
  openReceivableCount: "5",
  overdueReceivableCount: "2",
  businessLocalDate: "2026-11-04",
  timeZone: "America/El_Salvador",
  ...scope,
} as ReceivablesSummary;

const debtors: Debtors = {
  items: [
    {
      customerId: "20000000-0000-4000-8000-000000000001",
      customerName: "Comedor El Pilar",
      outstandingMinorUnits: "4195",
      overdueMinorUnits: "4195",
      openReceivableCount: "1",
      overdueSinceLocalDate: "2026-10-22",
      nextDueLocalDate: null,
    },
  ],
  customerCount: "4",
  businessLocalDate: "2026-11-04",
  ...scope,
};

const payables: PayablesSummaryResponse["data"] = {
  outstandingMinorUnits: "70974",
  dueSoonMinorUnits: "10970",
  overdueMinorUnits: "41314",
  openPurchaseCount: "8",
  nextDue: {
    purchaseId: "30000000-0000-4000-8000-000000000001",
    supplierName: "Abarrotes Mayoreo El Sol",
    dueDate: "2026-11-06",
    balanceMinorUnits: "10970",
  },
  businessLocalDate: "2026-11-04",
  ...scope,
};

const product = (id: string, name: string): Product => ({
  id,
  name,
  status: "active",
  sku: null,
  categoryId: null,
  tracked: true,
  lowStockThresholdMinorUnits: "5",
  quantityPrecision: 0,
  unitKind: "unit",
  sellingPriceCurrency: "USD",
  sellingPriceCurrencyMinorUnitDigits: 2,
  sellingPriceMinorUnits: "325",
  createdAt: "2026-10-01T12:00:00Z",
  updatedAt: "2026-10-01T12:00:00Z",
});

function facts(overrides: Partial<BusinessFacts<Actor>> = {}) {
  const reads: Array<[string, unknown]> = [];
  const logged =
    <Arguments extends unknown[], Result>(name: string, result: (...input: Arguments) => Result) =>
    async (_actor: Actor, ...input: Arguments) => {
      reads.push([name, input[0]]);
      return result(...input);
    };
  const value: BusinessFacts<Actor> = {
    salesSummary: logged("salesSummary", () => sales),
    operatingReport: logged("operatingReport", report),
    moneyTrend: logged("moneyTrend", () => trend),
    receivablesSummary: logged("receivablesSummary", () => receivables),
    debtors: logged("debtors", () => debtors),
    payablesSummary: logged("payablesSummary", () => payables),
    lowStock: logged("lowStock", () => ({
      items: [
        {
          product: product("40000000-0000-4000-8000-000000000001", "Azúcar 1 lb"),
          stock: {
            productId: "40000000-0000-4000-8000-000000000001",
            quantityPrecision: 0,
            onHandMinorUnits: "3",
            lowStockThresholdMinorUnits: "5",
            lowStock: true,
          },
        },
        {
          product: product("40000000-0000-4000-8000-000000000002", "Arroz 1 lb"),
          stock: {
            productId: "40000000-0000-4000-8000-000000000002",
            quantityPrecision: 0,
            onHandMinorUnits: "48",
            lowStockThresholdMinorUnits: "15",
            lowStock: false,
          },
        },
      ],
      nextCursor: "next",
    })),
    ...overrides,
  };
  return { facts: value, reads };
}

const answer = (
  topic: Parameters<typeof answerBusinessQuestion>[2]["topic"],
  period?: BusinessPeriod,
  overrides?: Partial<BusinessFacts<Actor>>,
) => {
  const composed = facts(overrides);
  return answerBusinessQuestion(composed.facts, actor, { topic, period }, "2026-11-04").then(
    (result) => ({ result, reads: composed.reads }),
  );
};

describe("business answers", () => {
  test("sales reads the stated period and keeps the exact gross and count", async () => {
    const { result, reads } = await answer("sales", "yesterday");
    expect(result).toEqual({
      topic: "sales",
      period: { key: "yesterday", startLocalDate: "2026-11-03", endLocalDate: "2026-11-03" },
      grossMinorUnits: "9750",
      saleCount: "3",
      averageMinorUnits: "3250",
      businessLocalDate: "2026-11-04",
      ...scope,
    });
    expect(reads).toEqual([
      ["salesSummary", { startLocalDate: "2026-11-03", endLocalDate: "2026-11-03" }],
    ]);
  });

  test("an unstated period is the month in progress and the answer says so", async () => {
    const { result, reads } = await answer("expenses");
    expect(result).toMatchObject({
      topic: "expenses",
      period: { key: "this_month", startLocalDate: "2026-11-01", endLocalDate: "2026-11-04" },
      totalMinorUnits: "7400",
      expenseCount: "2",
      categories: [{ category: "utilities" }, { category: "transport" }],
    });
    expect(reads).toEqual([
      ["operatingReport", { startLocalDate: "2026-11-01", endLocalDate: "2026-11-04" }],
    ]);
  });

  test("the summary carries sales, expenses and money moved, never a profit figure", async () => {
    const { result } = await answer("summary", "last_week");
    expect(result).toEqual({
      topic: "summary",
      period: { key: "last_week", startLocalDate: "2026-10-26", endLocalDate: "2026-11-01" },
      salesGrossMinorUnits: "9750",
      saleCount: "3",
      expensesTotalMinorUnits: "7400",
      expenseCount: "2",
      cashInflowMinorUnits: "8000",
      cashOutflowMinorUnits: "7400",
      businessLocalDate: "2026-11-04",
      ...scope,
    });
    expect(JSON.stringify(result)).not.toMatch(/profit|margin|ganancia/i);
  });

  test("ranks products and says how many sales carried product lines", async () => {
    const { result } = await answer("top_products", "this_week");
    expect(result).toMatchObject({
      topic: "top_products",
      saleCount: "3",
      itemizedSaleCount: "2",
      products: [{ name: "Café molido 1 lb", quantityMinorUnits: "6", grossMinorUnits: "1950" }],
    });
  });

  test("cash is the money available now, by kind of account", async () => {
    const { result, reads } = await answer("cash", "last_month");
    expect(result).toEqual({
      topic: "cash",
      totalMinorUnits: "233193",
      activeAccountCount: "2",
      kinds: trend.kinds,
      businessLocalDate: "2026-11-04",
      ...scope,
    });
    expect(reads).toEqual([["moneyTrend", undefined]]);
  });

  test("receivables join the totals with the customers who owe the most", async () => {
    const { result } = await answer("receivables");
    expect(result).toMatchObject({
      topic: "receivables",
      outstandingMinorUnits: "8160",
      overdueMinorUnits: "4195",
      customerCount: "4",
      debtors: [{ customerName: "Comedor El Pilar", overdueSinceLocalDate: "2026-10-22" }],
    });
  });

  test("payables report the balance, what is overdue and the next due purchase", async () => {
    const { result } = await answer("payables");
    expect(result).toMatchObject({
      topic: "payables",
      outstandingMinorUnits: "70974",
      overdueMinorUnits: "41314",
      openPurchaseCount: "8",
      nextDue: { supplierName: "Abarrotes Mayoreo El Sol", dueDate: "2026-11-06" },
    });
  });

  test("low stock lists the products at or under their minimum and says when there are more", async () => {
    const { result, reads } = await answer("low_stock");
    expect(result).toEqual({
      topic: "low_stock",
      products: [
        {
          productId: "40000000-0000-4000-8000-000000000001",
          name: "Azúcar 1 lb",
          unitKind: "unit",
          quantityPrecision: 0,
          onHandMinorUnits: "3",
          lowStockThresholdMinorUnits: "5",
        },
      ],
      more: true,
      businessLocalDate: "2026-11-04",
    });
    expect(reads).toEqual([["lowStock", 8]]);
  });

  test("a failed read rejects instead of answering with zeros", async () => {
    const failing = answer("sales", "today", {
      salesSummary: async () => {
        throw new Error("The database is unreachable");
      },
    });
    await expect(failing).rejects.toThrow("The database is unreachable");
  });

  test("a legitimate empty period answers zero sales and no average", async () => {
    const { result } = await answer("sales", "today", {
      salesSummary: async () => ({
        ...sales,
        grossMinorUnits: "0",
        saleCount: "0",
        averageMinorUnits: null,
        itemizedSaleCount: "0",
        topProducts: [],
      }),
    });
    expect(result).toMatchObject({ grossMinorUnits: "0", saleCount: "0", averageMinorUnits: null });
  });
});
