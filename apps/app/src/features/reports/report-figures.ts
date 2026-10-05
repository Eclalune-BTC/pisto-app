import type { OperatingReport } from "@pisto/contracts";

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
