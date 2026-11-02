import { z } from "zod";

import {
  aggregateIntegerSchema,
  boundedListLimitSchema,
  calendarLocalDateSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  entrySourceSchema,
  localTimeSchema,
  opaqueCursorSchema,
  positiveMinorUnitsSchema,
  shortRequestTextSchema,
  signedAggregateIntegerSchema,
  signedMinorUnitsSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";

export const cashAccountKindSchema = z.enum(["cash", "bank", "mobile_money", "other"]);
export const cashAccountStatusSchema = z.enum(["active", "archived"]);
export const cashMovementDirectionSchema = z.enum(["in", "out"]);
export const cashMovementActionSchema = z.enum([
  "opening",
  "expense",
  "adjustment_in",
  "adjustment_out",
  "transfer_in",
  "transfer_out",
  "receivable_payment",
  "reverse",
]);

export const expenseCategorySchema = z.enum([
  "inventory",
  "rent",
  "utilities",
  "payroll",
  "transport",
  "marketing",
  "tax",
  "other",
]);
export const expenseStatusSchema = z.enum(["posted", "voided"]);

const accountNameSchema = z.string().trim().min(1).max(80);
const optionalPayeeSchema = z.string().trim().min(1).max(120).optional();

const cashAccountSchema = z
  .object({
    id: uuidSchema,
    name: accountNameSchema,
    kind: cashAccountKindSchema,
    status: cashAccountStatusSchema,
    allowNegativeBalance: z.boolean(),
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    balanceMinorUnits: signedAggregateIntegerSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

/** Movements the system writes for transfers and receivables, which may carry no typed reason. */
export const systemDescribedCashActions = [
  "transfer_in",
  "transfer_out",
  "receivable_payment",
  "reverse",
] as const;

const cashMovementSchema = z
  .object({
    id: uuidSchema,
    accountId: uuidSchema,
    direction: cashMovementDirectionSchema,
    action: cashMovementActionSchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    deltaMinorUnits: signedMinorUnitsSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    occurredAt: timestampSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    timeZone: timeZoneSchema,
    /** Null when the system wrote the movement; clients describe it from its action and source. */
    reason: z.string().min(1).max(240).nullable(),
    expenseId: uuidSchema.nullable(),
    transferId: uuidSchema.nullable(),
    receivablePaymentId: uuidSchema.nullable(),
    reversalOfMovementId: uuidSchema.nullable(),
    createdAt: timestampSchema,
  })
  .strict()
  .refine(
    (movement) =>
      movement.reason !== null ||
      (systemDescribedCashActions as readonly string[]).includes(movement.action),
    { message: "Only a system-written movement may omit its reason", path: ["reason"] },
  );

const cashTransferSchema = z
  .object({
    id: uuidSchema,
    fromAccountId: uuidSchema,
    toAccountId: uuidSchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    occurredAt: timestampSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    timeZone: timeZoneSchema,
    note: z.string().min(1).max(240).nullable(),
    outMovementId: uuidSchema,
    inMovementId: uuidSchema,
    createdAt: timestampSchema,
  })
  .strict();

const expenseSchema = z
  .object({
    id: uuidSchema,
    accountId: uuidSchema,
    status: expenseStatusSchema,
    category: expenseCategorySchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    description: z.string().min(1).max(240),
    payee: z.string().min(1).max(120).nullable(),
    occurredAt: timestampSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    timeZone: timeZoneSchema,
    voidedAt: timestampSchema.nullable(),
    voidReason: z.string().min(1).max(240).nullable(),
    createdAt: timestampSchema,
  })
  .strict();

const explicitOpeningSchema = z
  .object({
    direction: cashMovementDirectionSchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    reason: shortRequestTextSchema,
  })
  .strict();

export const createCashAccountRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    name: accountNameSchema,
    kind: cashAccountKindSchema,
    allowNegativeBalance: z.boolean(),
    currency: currencyCodeSchema,
    opening: explicitOpeningSchema.nullable(),
  })
  .strict();

export const updateCashAccountRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    name: accountNameSchema.optional(),
    kind: cashAccountKindSchema.optional(),
    allowNegativeBalance: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.kind !== undefined ||
      value.allowNegativeBalance !== undefined,
    "At least one account field must be provided",
  );

export const archiveCashAccountRequestSchema = z.object({ idempotencyKey: uuidSchema }).strict();

export const cashAccountCommandResultSchema = z
  .object({
    account: cashAccountSchema,
    openingMovement: cashMovementSchema.nullable(),
    replayed: z.boolean(),
  })
  .strict();

export const cashAccountResponseSchema = z
  .object({ data: cashAccountCommandResultSchema })
  .strict();

export const cashAccountDetailResponseSchema = z
  .object({ data: z.object({ account: cashAccountSchema }).strict() })
  .strict();

export const cashAccountListQuerySchema = z
  .object({
    cursor: opaqueCursorSchema.optional(),
    limit: boundedListLimitSchema,
    status: z.enum(["active", "archived", "all"]).default("active"),
  })
  .strict();

const cashAccountListSchema = z
  .object({
    items: z.array(cashAccountSchema),
    nextCursor: opaqueCursorSchema.nullable(),
    queriedAt: timestampSchema,
  })
  .strict();

export const cashAccountListResponseSchema = z.object({ data: cashAccountListSchema }).strict();

export const postExpenseRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    accountId: uuidSchema,
    category: expenseCategorySchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    currency: currencyCodeSchema,
    description: shortRequestTextSchema,
    payee: optionalPayeeSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    entrySource: entrySourceSchema.default("manual"),
  })
  .strict();

export const voidExpenseRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    reason: shortRequestTextSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
  })
  .strict();

export const expenseCommandResultSchema = z
  .object({
    expense: expenseSchema,
    movement: cashMovementSchema,
    replayed: z.boolean(),
  })
  .strict();

export const expenseResponseSchema = z.object({ data: expenseCommandResultSchema }).strict();

export const expenseDetailResponseSchema = z
  .object({ data: z.object({ expense: expenseSchema }).strict() })
  .strict();

export const expenseListQuerySchema = z
  .object({
    cursor: opaqueCursorSchema.optional(),
    limit: boundedListLimitSchema,
    status: z.enum(["posted", "voided", "all"]).default("posted"),
    category: expenseCategorySchema.optional(),
    accountId: uuidSchema.optional(),
  })
  .strict();

const expenseListSchema = z
  .object({
    items: z.array(expenseSchema),
    nextCursor: opaqueCursorSchema.nullable(),
    queriedAt: timestampSchema,
  })
  .strict();

export const expenseListResponseSchema = z.object({ data: expenseListSchema }).strict();

export const expensePeriodQuerySchema = z
  .object({
    startLocalDate: calendarLocalDateSchema,
    endLocalDate: calendarLocalDateSchema,
  })
  .strict();

const expenseCategoryTotalSchema = z
  .object({
    category: expenseCategorySchema,
    amountMinorUnits: aggregateIntegerSchema,
    expenseCount: aggregateIntegerSchema,
  })
  .strict();

const expensePeriodSummarySchema = z
  .object({
    periodStartLocal: calendarLocalDateSchema,
    periodEndLocalInclusive: calendarLocalDateSchema,
    periodStartUtc: timestampSchema,
    periodEndUtcExclusive: timestampSchema,
    timeZone: timeZoneSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    totalMinorUnits: aggregateIntegerSchema,
    expenseCount: aggregateIntegerSchema,
    categories: z.array(expenseCategoryTotalSchema),
    queriedAt: timestampSchema,
  })
  .strict();

export const expensePeriodSummaryResponseSchema = z
  .object({ data: z.object({ summary: expensePeriodSummarySchema }).strict() })
  .strict();

export const recordCashAdjustmentRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    accountId: uuidSchema,
    direction: cashMovementDirectionSchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    currency: currencyCodeSchema,
    reason: shortRequestTextSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
  })
  .strict();

export const reverseCashMovementRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    reason: shortRequestTextSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
  })
  .strict();

export const cashMovementCommandResultSchema = z
  .object({ movement: cashMovementSchema, replayed: z.boolean() })
  .strict();

export const cashMovementResponseSchema = z
  .object({ data: cashMovementCommandResultSchema })
  .strict();

export const cashMovementListQuerySchema = z
  .object({
    cursor: opaqueCursorSchema.optional(),
    limit: boundedListLimitSchema,
    accountId: uuidSchema.optional(),
  })
  .strict();

const cashMovementListSchema = z
  .object({
    items: z.array(cashMovementSchema),
    nextCursor: opaqueCursorSchema.nullable(),
    queriedAt: timestampSchema,
  })
  .strict();

export const cashMovementListResponseSchema = z.object({ data: cashMovementListSchema }).strict();

export const transferCashRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    fromAccountId: uuidSchema,
    toAccountId: uuidSchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    currency: currencyCodeSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    note: shortRequestTextSchema.optional(),
  })
  .strict()
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "Transfer accounts must be different",
    path: ["toAccountId"],
  });

export const cashTransferCommandResultSchema = z
  .object({
    transfer: cashTransferSchema,
    movements: z.tuple([cashMovementSchema, cashMovementSchema]),
    replayed: z.boolean(),
  })
  .strict();

export const cashTransferResponseSchema = z
  .object({ data: cashTransferCommandResultSchema })
  .strict();

export type CashAccountKind = z.infer<typeof cashAccountKindSchema>;
export type CashAccountStatus = z.infer<typeof cashAccountStatusSchema>;
export type CashMovementDirection = z.infer<typeof cashMovementDirectionSchema>;
export type CashMovementAction = z.infer<typeof cashMovementActionSchema>;
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;
export type ExpenseStatus = z.infer<typeof expenseStatusSchema>;
export type CashAccount = z.infer<typeof cashAccountSchema>;
export type CashMovement = z.infer<typeof cashMovementSchema>;
export type CashTransfer = z.infer<typeof cashTransferSchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type CreateCashAccountRequest = z.infer<typeof createCashAccountRequestSchema>;
export type UpdateCashAccountRequest = z.infer<typeof updateCashAccountRequestSchema>;
export type ArchiveCashAccountRequest = z.infer<typeof archiveCashAccountRequestSchema>;
export type CashAccountCommandResult = z.infer<typeof cashAccountCommandResultSchema>;
export type CashAccountListQuery = z.input<typeof cashAccountListQuerySchema>;
export type CashAccountList = z.infer<typeof cashAccountListSchema>;
export type PostExpenseRequest = z.input<typeof postExpenseRequestSchema>;
export type VoidExpenseRequest = z.infer<typeof voidExpenseRequestSchema>;
export type ExpenseCommandResult = z.infer<typeof expenseCommandResultSchema>;
export type ExpenseListQuery = z.input<typeof expenseListQuerySchema>;
export type ExpenseList = z.infer<typeof expenseListSchema>;
export type ExpensePeriodQuery = z.infer<typeof expensePeriodQuerySchema>;
export type ExpensePeriodSummary = z.infer<typeof expensePeriodSummarySchema>;
export type RecordCashAdjustmentRequest = z.infer<typeof recordCashAdjustmentRequestSchema>;
export type ReverseCashMovementRequest = z.infer<typeof reverseCashMovementRequestSchema>;
export type CashMovementCommandResult = z.infer<typeof cashMovementCommandResultSchema>;
export type CashMovementListQuery = z.input<typeof cashMovementListQuerySchema>;
export type CashMovementList = z.infer<typeof cashMovementListSchema>;
export type TransferCashRequest = z.infer<typeof transferCashRequestSchema>;
export type CashTransferCommandResult = z.infer<typeof cashTransferCommandResultSchema>;
