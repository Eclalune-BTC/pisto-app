import { z } from "zod";

import {
  aggregateIntegerSchema,
  calendarLocalDateSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  timestampSchema,
  uuidSchema,
} from "./primitives";

export const maximumDebtors = 5;

const debtorSchema = z
  .object({
    customerId: uuidSchema,
    customerName: z.string().min(1).max(120),
    outstandingMinorUnits: aggregateIntegerSchema,
    overdueMinorUnits: aggregateIntegerSchema,
    openReceivableCount: aggregateIntegerSchema,
    /** Earliest due date already past among the customer's open receivables. */
    overdueSinceLocalDate: calendarLocalDateSchema.nullable(),
    /** Earliest due date from today on among the customer's open receivables. */
    nextDueLocalDate: calendarLocalDateSchema.nullable(),
  })
  .strict();

/**
 * Customers who owe the most, overdue first. `customerCount` counts every customer with an open
 * balance, so the client can say how many are not listed.
 */
export const debtorsSchema = z
  .object({
    items: z.array(debtorSchema).max(maximumDebtors),
    customerCount: aggregateIntegerSchema,
    businessLocalDate: calendarLocalDateSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    queriedAt: timestampSchema,
  })
  .strict();

export const debtorsResponseSchema = z
  .object({ data: z.object({ debtors: debtorsSchema }).strict() })
  .strict();

export type Debtor = z.infer<typeof debtorSchema>;
export type Debtors = z.infer<typeof debtorsSchema>;
export type DebtorsResponse = z.infer<typeof debtorsResponseSchema>;
