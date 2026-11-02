import type { CashFlowReport, OperatingReport } from "@pisto/contracts";
import type { TFunction } from "i18next";
import { formatMonthName } from "@/i18n/format";

type ExpenseCategoryFacts = OperatingReport["expenses"]["categories"][number];

export type ExpenseCategoryShare = ExpenseCategoryFacts & {
  /** Share of the period's expense total in tenths of a percent, rounded half up. */
  shareTenths: number;
};

/**
 * Whether anything was published in the period. Internal transfers count: they move the accounts
 * listed in the report even though the business inflow and outflow exclude them.
 */
export function hasPeriodActivity(report: OperatingReport): boolean {
  return (
    report.sales.saleCount !== "0" ||
    report.expenses.expenseCount !== "0" ||
    report.cash.accounts.some(
      ({ inflowMinorUnits, outflowMinorUnits }) =>
        inflowMinorUnits !== "0" || outflowMinorUnits !== "0",
    )
  );
}

/** A canonical integer string formats exactly; a number would round above 2^53. */
export function formatCount(value: string, locale: string): string {
  // The DOM lib types that overload as a template-literal type no plain string can satisfy.
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value as Intl.StringNumericLiteral,
  );
}

/**
 * The period's categories largest first, each with its share of the total. The breakdown is the
 * complete result for the period, so ordering it by exact amount hides nothing.
 */
export function expenseCategoryShares(
  expenses: OperatingReport["expenses"],
): ExpenseCategoryShare[] {
  const total = BigInt(expenses.totalMinorUnits);
  return [...expenses.categories]
    .sort((left, right) => {
      const a = BigInt(left.totalMinorUnits);
      const b = BigInt(right.totalMinorUnits);
      return a === b ? 0 : a < b ? 1 : -1;
    })
    .map((category) => ({
      ...category,
      shareTenths:
        total === 0n
          ? 0
          : Number((BigInt(category.totalMinorUnits) * 2000n + total) / (2n * total)),
    }));
}

/** A share in tenths of a percent; a positive amount never reads as zero. */
export function formatShare(category: ExpenseCategoryShare, locale: string): string {
  const percent = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent",
  });
  if (category.shareTenths === 0 && category.totalMinorUnits !== "0") {
    return `<${percent.format(0.001)}`;
  }
  return percent.format(category.shareTenths / 1000);
}

/** A share in tenths of a percent, "20.5 %", with one decimal like the expense shares. */
export function formatTenthsPercent(shareTenths: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 1,
    style: "percent",
  }).format(shareTenths / 1000);
}

/**
 * Sales minus the expenses posted in the period, and its share of sales in tenths of a percent
 * rounded half away from zero. Without sales the share is undefined, not zero.
 */
export function resultOfSales(report: OperatingReport): {
  minorUnits: string;
  shareTenths: number | null;
  sign: -1 | 0 | 1;
} {
  const sales = BigInt(report.sales.grossMinorUnits);
  const result = sales - BigInt(report.expenses.totalMinorUnits);
  const sign = result === 0n ? 0 : result > 0n ? 1 : -1;
  if (sales === 0n) return { minorUnits: result.toString(), shareTenths: null, sign };
  const magnitude = (result < 0n ? -result : result) * 2000n;
  const tenths = (magnitude + sales) / (2n * sales);
  return {
    minorUnits: result.toString(),
    shareTenths: Number(result < 0n ? -tenths : tenths),
    sign,
  };
}

/** "Mayo", or "Noviembre, al 2" for the month still in progress on the report date. */
export function cashFlowMonthLabel(
  month: string,
  asOfLocalDate: string,
  locale: string,
  t: TFunction,
): string {
  const capitalized = capitalizeFirst(formatMonthName(`${month}-01`, locale, "long"), locale);
  return asOfLocalDate.slice(0, 7) === month
    ? t("reports.cashFlow.monthToDate", {
        day: Number(asOfLocalDate.slice(8, 10)),
        month: capitalized,
      })
    : capitalized;
}

/**
 * Bar heights in pixels against the largest inflow or outflow of the shown months. Any movement
 * keeps a visible sliver so a small month is not drawn as an empty one.
 */
export function barHeights(
  months: readonly Pick<
    CashFlowReport["months"][number],
    "inflowMinorUnits" | "outflowMinorUnits"
  >[],
  height: number,
): { inflow: number; outflow: number }[] {
  let largest = 0n;
  for (const month of months) {
    for (const value of [month.inflowMinorUnits, month.outflowMinorUnits]) {
      if (BigInt(value) > largest) largest = BigInt(value);
    }
  }
  const scale = (value: string) => {
    const amount = BigInt(value);
    if (amount === 0n || largest === 0n) return 0;
    return Math.max(2, Number((amount * BigInt(height) * 100n) / largest) / 100);
  };
  return months.map((month) => ({
    inflow: scale(month.inflowMinorUnits),
    outflow: scale(month.outflowMinorUnits),
  }));
}

/** Spanish month names are lower case; a label that starts a line takes a capital. */
export function capitalizeFirst(text: string, locale: string): string {
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}
