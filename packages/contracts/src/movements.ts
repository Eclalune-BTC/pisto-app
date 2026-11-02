import { z } from "zod";

import { expenseCategorySchema } from "./cash";
import {
  aggregateIntegerSchema,
  boundedListLimitSchema,
  calendarLocalDateSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  entrySourceSchema,
  localTimeSchema,
  opaqueCursorSchema,
  signedAggregateIntegerSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";
import { maximumInclusiveDays } from "./reports";

/**
 * Sales, purchases, expenses and payments in one ledger. Cash openings, adjustments and transfers
 * stay in the cash account ledger, so an account filter here lists records, not its balance.
 */
export const movementKindSchema = z.enum([
  "sale",
  "purchase",
  "expense",
  "receivable_payment",
  "supplier_payment",
]);

export const movementKindFilterSchema = z.enum(["all", ...movementKindSchema.options]);

const millisecondsPerDay = 86_400_000;

export const movementListQuerySchema = z
  .object({
    startLocalDate: calendarLocalDateSchema,
    endLocalDate: calendarLocalDateSchema,
    kind: movementKindFilterSchema.default("all"),
    accountId: uuidSchema.optional(),
    query: z.string().trim().min(1).max(80).optional(),
    cursor: opaqueCursorSchema.optional(),
    limit: boundedListLimitSchema,
  })
  .strict()
  .superRefine(
    (value, context) => {
      const start = Date.parse(`${value.startLocalDate}T00:00:00.000Z`);
      const end = Date.parse(`${value.endLocalDate}T00:00:00.000Z`);
      if (end < start) {
        context.addIssue({
          code: "custom",
          message: "The start date must not follow the end date",
          path: ["endLocalDate"],
        });
      } else if ((end - start) / millisecondsPerDay + 1 > maximumInclusiveDays) {
        context.addIssue({
          code: "custom",
          message: `The range cannot exceed ${maximumInclusiveDays} inclusive days`,
          path: ["endLocalDate"],
        });
      }
    },
    { when: (payload) => payload.issues.length === 0 },
  );

/**
 * Facts the client words into a title and subtitle; each kind fills the ones it has.
 * `totalMinorUnits` is the record total when the moved amount is only part of it (a sale paid in
 * part); `lineCount` counts product lines of an itemized record.
 */
const movementFactsSchema = z
  .object({
    description: z.string().min(1).max(240).nullable(),
    counterpartyName: z.string().min(1).max(120).nullable(),
    expenseCategory: expenseCategorySchema.nullable(),
    reference: z.string().min(1).max(120).nullable(),
    lineCount: aggregateIntegerSchema.nullable(),
    totalMinorUnits: aggregateIntegerSchema.nullable(),
  })
  .strict();

export const movementSchema = z
  .object({
    kind: movementKindSchema,
    /** The source record (sale, expense, receivable payment, …) that the row opens. */
    recordId: uuidSchema,
    /** Present for a receivable payment, whose record lives under its receivable. */
    parentRecordId: uuidSchema.nullable(),
    occurredAt: timestampSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    /** Positive when money came in, negative when it went out. */
    amountMinorUnits: signedAggregateIntegerSchema,
    accountId: uuidSchema.nullable(),
    accountName: z.string().min(1).max(80).nullable(),
    entrySource: entrySourceSchema,
    facts: movementFactsSchema,
  })
  .strict();

const movementTotalsSchema = z
  .object({
    inflowMinorUnits: aggregateIntegerSchema,
    outflowMinorUnits: aggregateIntegerSchema,
    netMinorUnits: signedAggregateIntegerSchema,
  })
  .strict();

const movementDayTotalsSchema = movementTotalsSchema
  .extend({ localDate: calendarLocalDateSchema })
  .strict();

/**
 * `totals` covers every movement matching the filters in the period, not only this page;
 * `days` gives the same totals for each local date that appears in `items`.
 */
export const movementListSchema = z
  .object({
    items: z.array(movementSchema),
    nextCursor: opaqueCursorSchema.nullable(),
    totals: movementTotalsSchema,
    days: z.array(movementDayTotalsSchema),
    period: z
      .object({
        startLocalDate: calendarLocalDateSchema,
        endLocalDate: calendarLocalDateSchema,
        timeZone: timeZoneSchema,
      })
      .strict(),
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    queriedAt: timestampSchema,
  })
  .strict();

export const movementListResponseSchema = z.object({ data: movementListSchema }).strict();

export type MovementKind = z.infer<typeof movementKindSchema>;
export type MovementKindFilter = z.infer<typeof movementKindFilterSchema>;
export type MovementListQuery = z.input<typeof movementListQuerySchema>;
export type Movement = z.infer<typeof movementSchema>;
export type MovementList = z.infer<typeof movementListSchema>;
export type MovementListResponse = z.infer<typeof movementListResponseSchema>;
