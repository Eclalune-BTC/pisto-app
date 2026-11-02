import { z } from "zod";

import { cashAccountKindSchema } from "./cash";
import {
  aggregateIntegerSchema,
  calendarLocalDateSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  signedAggregateIntegerSchema,
  timestampSchema,
  timeZoneSchema,
} from "./primitives";

export const moneyTrendRangeSchema = z.enum(["7d", "30d", "6m"]);

export const moneyTrendQuerySchema = z
  .object({ range: moneyTrendRangeSchema.default("30d") })
  .strict();

const moneyTrendPointSchema = z
  .object({
    localDate: calendarLocalDateSchema,
    closingMinorUnits: signedAggregateIntegerSchema,
  })
  .strict();

const moneyTrendKindSchema = z
  .object({
    kind: cashAccountKindSchema,
    accountCount: aggregateIntegerSchema,
    balanceMinorUnits: signedAggregateIntegerSchema,
  })
  .strict();

/**
 * Money held in the business's active cash accounts, closed per business-local day. Every figure
 * counts movements dated up to `endLocalDate` (the business's today); `openingMinorUnits` is the
 * total before `startLocalDate`, so `changeMinorUnits` is what the range added or removed.
 */
export const moneyTrendSchema = z
  .object({
    range: moneyTrendRangeSchema,
    startLocalDate: calendarLocalDateSchema,
    endLocalDate: calendarLocalDateSchema,
    timeZone: timeZoneSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    activeAccountCount: aggregateIntegerSchema,
    openingMinorUnits: signedAggregateIntegerSchema,
    closingMinorUnits: signedAggregateIntegerSchema,
    changeMinorUnits: signedAggregateIntegerSchema,
    points: z.array(moneyTrendPointSchema).min(1),
    kinds: z.array(moneyTrendKindSchema),
    queriedAt: timestampSchema,
  })
  .strict();

export const moneyTrendResponseSchema = z
  .object({ data: z.object({ trend: moneyTrendSchema }).strict() })
  .strict();

export type MoneyTrendRange = z.infer<typeof moneyTrendRangeSchema>;
export type MoneyTrendQuery = z.input<typeof moneyTrendQuerySchema>;
export type MoneyTrend = z.infer<typeof moneyTrendSchema>;
export type MoneyTrendResponse = z.infer<typeof moneyTrendResponseSchema>;
