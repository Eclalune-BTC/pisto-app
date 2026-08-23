import { z } from "zod";

import { cashAccountKindSchema, cashAccountStatusSchema, expenseCategorySchema } from "./cash";
import {
  aggregateIntegerSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  localDateSchema,
  signedAggregateIntegerSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";

const millisecondsPerDay = 86_400_000;
export const maximumInclusiveDays = 366;

function localDateEpoch(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = Date.UTC(year, month - 1, day);
  const parsed = new Date(epoch);
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
    ? epoch
    : null;
}

export const operatingReportQuerySchema = z
  .object({
    startLocalDate: localDateSchema,
    endLocalDate: localDateSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const start = localDateEpoch(value.startLocalDate);
    const end = localDateEpoch(value.endLocalDate);
    if (start === null) {
      context.addIssue({
        code: "custom",
        message: "The report start date is not a real calendar date",
        path: ["startLocalDate"],
      });
    }
    if (end === null) {
      context.addIssue({
        code: "custom",
        message: "The report end date is not a real calendar date",
        path: ["endLocalDate"],
      });
    }
    if (start === null || end === null) return;
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
  });

export const reportPeriodSchema = z
  .object({
    startLocalDate: localDateSchema,
    endLocalDateInclusive: localDateSchema,
    startUtc: timestampSchema,
    endUtcExclusive: timestampSchema,
    timeZone: timeZoneSchema,
  })
  .strict();

export const reportSalesFactsSchema = z
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

export const reportExpenseFactsSchema = z
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

export const reportCashFactsSchema = z
  .object({
    inflowMinorUnits: aggregateIntegerSchema,
    outflowMinorUnits: aggregateIntegerSchema,
    netMovementMinorUnits: signedAggregateIntegerSchema,
    accounts: z.array(reportCashAccountFactsSchema),
  })
  .strict();

export const reportInventoryFactsSchema = z
  .object({
    trackedProductCount: aggregateIntegerSchema,
    lowStockProductCount: aggregateIntegerSchema,
  })
  .strict();

export const reportReceivableFactsSchema = z
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
    positionAsOfLocalDate: localDateSchema,
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

export type OperatingReportQuery = z.infer<typeof operatingReportQuerySchema>;
export type ReportPeriod = z.infer<typeof reportPeriodSchema>;
export type ReportSalesFacts = z.infer<typeof reportSalesFactsSchema>;
export type ReportExpenseCategoryFacts = z.infer<typeof reportExpenseCategoryFactsSchema>;
export type ReportExpenseFacts = z.infer<typeof reportExpenseFactsSchema>;
export type ReportCashAccountFacts = z.infer<typeof reportCashAccountFactsSchema>;
export type ReportCashFacts = z.infer<typeof reportCashFactsSchema>;
export type ReportInventoryFacts = z.infer<typeof reportInventoryFactsSchema>;
export type ReportReceivableFacts = z.infer<typeof reportReceivableFactsSchema>;
export type OperatingReport = z.infer<typeof operatingReportSchema>;
export type OperatingReportResponse = z.infer<typeof operatingReportResponseSchema>;
