import { z } from "zod";

import { cashAccountKindSchema, cashAccountStatusSchema, expenseCategorySchema } from "./cash";
import {
  aggregateIntegerSchema,
  calendarLocalDateSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  signedAggregateIntegerSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";

const millisecondsPerDay = 86_400_000;
export const maximumInclusiveDays = 366;

function localDateEpoch(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

export const operatingReportQuerySchema = z
  .object({
    startLocalDate: calendarLocalDateSchema,
    endLocalDate: calendarLocalDateSchema,
  })
  .strict()
  // Calendar-date issues do not abort the object, so the `when` gate keeps an invalid date such as
  // 2026-02-30 from rolling over in Date.parse and adding a spurious range issue.
  .superRefine(
    (value, context) => {
      const start = localDateEpoch(value.startLocalDate);
      const end = localDateEpoch(value.endLocalDate);
      if (end < start) {
        context.addIssue({
          code: "custom",
          message: "The report start date must not follow its end date",
          path: ["endLocalDate"],
        });
        return;
      }
      if ((end - start) / millisecondsPerDay + 1 > maximumInclusiveDays) {
        context.addIssue({
          code: "custom",
          message: `The report range cannot exceed ${maximumInclusiveDays} inclusive days`,
          path: ["endLocalDate"],
        });
      }
    },
    { when: (payload) => payload.issues.length === 0 },
  );

const reportPeriodSchema = z
  .object({
    startLocalDate: calendarLocalDateSchema,
    endLocalDateInclusive: calendarLocalDateSchema,
    startUtc: timestampSchema,
    endUtcExclusive: timestampSchema,
    timeZone: timeZoneSchema,
  })
  .strict();

const reportSalesFactsSchema = z
  .object({
    grossMinorUnits: aggregateIntegerSchema,
    saleCount: aggregateIntegerSchema,
  })
  .strict();

export const reportExpenseCategoryFactsSchema = z
  .object({
    category: expenseCategorySchema,
    totalMinorUnits: aggregateIntegerSchema,
    expenseCount: aggregateIntegerSchema,
  })
  .strict();

const reportExpenseFactsSchema = z
  .object({
    totalMinorUnits: aggregateIntegerSchema,
    expenseCount: aggregateIntegerSchema,
    categories: z.array(reportExpenseCategoryFactsSchema),
  })
  .strict();

export const reportCashAccountFactsSchema = z
  .object({
    accountId: uuidSchema,
    accountName: z.string().min(1).max(80),
    accountKind: cashAccountKindSchema,
    accountStatus: cashAccountStatusSchema,
    inflowMinorUnits: aggregateIntegerSchema,
    outflowMinorUnits: aggregateIntegerSchema,
    netMovementMinorUnits: signedAggregateIntegerSchema,
  })
  .strict();

const reportCashFactsSchema = z
  .object({
    inflowMinorUnits: aggregateIntegerSchema,
    outflowMinorUnits: aggregateIntegerSchema,
    netMovementMinorUnits: signedAggregateIntegerSchema,
    accounts: z.array(reportCashAccountFactsSchema),
  })
  .strict();

const reportInventoryFactsSchema = z
  .object({
    trackedProductCount: aggregateIntegerSchema,
    lowStockProductCount: aggregateIntegerSchema,
  })
  .strict();

const reportReceivableFactsSchema = z
  .object({
    outstandingMinorUnits: aggregateIntegerSchema,
    overdueMinorUnits: aggregateIntegerSchema,
    openReceivableCount: aggregateIntegerSchema,
    overdueReceivableCount: aggregateIntegerSchema,
  })
  .strict();

export const operatingReportSchema = z
  .object({
    period: reportPeriodSchema,
    positionAsOfLocalDate: calendarLocalDateSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    sales: reportSalesFactsSchema,
    expenses: reportExpenseFactsSchema,
    cash: reportCashFactsSchema,
    inventory: reportInventoryFactsSchema,
    receivables: reportReceivableFactsSchema,
    queriedAt: timestampSchema,
  })
  .strict();

export const operatingReportResponseSchema = z
  .object({ data: z.object({ report: operatingReportSchema }).strict() })
  .strict();

/** A calendar month in the business time zone, "YYYY-MM". */
export const calendarMonthSchema = z
  .string()
  .regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "Must be a calendar month")
  .refine((value) => !value.startsWith("0000"), "Year zero is not supported");

export const maximumCashFlowMonths = 12;

export const cashFlowReportQuerySchema = z
  .object({
    endMonth: calendarMonthSchema,
    months: z.coerce.number().int().min(1).max(maximumCashFlowMonths).default(6),
  })
  .strict();

/**
 * Money that entered and left the business accounts in one month. Transfers between the
 * business's own accounts move no money in or out; the closing balance adds every account.
 */
const cashFlowMonthSchema = z
  .object({
    month: calendarMonthSchema,
    inflowMinorUnits: aggregateIntegerSchema,
    outflowMinorUnits: aggregateIntegerSchema,
    netMinorUnits: signedAggregateIntegerSchema,
    closingBalanceMinorUnits: signedAggregateIntegerSchema,
  })
  .strict();

export const cashFlowReportSchema = z
  .object({
    timeZone: timeZoneSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    /** The business-local date the report was read on; a later month has no movements yet. */
    asOfLocalDate: calendarLocalDateSchema,
    months: z.array(cashFlowMonthSchema).min(1).max(maximumCashFlowMonths),
    queriedAt: timestampSchema,
  })
  .strict();

export const cashFlowReportResponseSchema = z
  .object({ data: z.object({ report: cashFlowReportSchema }).strict() })
  .strict();

export type OperatingReportQuery = z.infer<typeof operatingReportQuerySchema>;
export type CashFlowReportQuery = z.input<typeof cashFlowReportQuerySchema>;
export type CashFlowReport = z.infer<typeof cashFlowReportSchema>;
export type CashFlowReportResponse = z.infer<typeof cashFlowReportResponseSchema>;
export type OperatingReport = z.infer<typeof operatingReportSchema>;
export type OperatingReportResponse = z.infer<typeof operatingReportResponseSchema>;
