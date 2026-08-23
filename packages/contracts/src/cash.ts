import { z } from "zod";

import {
  aggregateIntegerSchema,
  boundedListLimitSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  localDateSchema,
  localTimeSchema,
  minorUnitsSchema,
  positiveMinorUnitsSchema,
  signedAggregateIntegerSchema,
  signedMinorUnitsSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";

export const cashCurrencyCodeSchema = currencyCodeSchema;
export const cashCurrencyMinorUnitDigitsSchema = currencyMinorUnitDigitsSchema;
export const cashLocalDateSchema = localDateSchema;
export const cashLocalTimeSchema = localTimeSchema;
export const cashTimeZoneSchema = timeZoneSchema;
export const cashIdempotencyKeySchema = uuidSchema;
export const cashCursorSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/);

export const cashMinorUnitsSchema = minorUnitsSchema;
export const cashPositiveMinorUnitsSchema = positiveMinorUnitsSchema;
export const signedCashMinorUnitsSchema = signedMinorUnitsSchema;
export const signedCashAggregateMinorUnitsSchema = signedAggregateIntegerSchema;
export const cashAggregateIntegerSchema = aggregateIntegerSchema;

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
const descriptionSchema = z.string().trim().min(1).max(240);
const optionalPayeeSchema = z.string().trim().min(1).max(120).optional();
const optionalNoteSchema = z.string().trim().min(1).max(240).optional();

export const cashAccountSchema = z
  .object({
    id: uuidSchema,
    name: accountNameSchema,
    kind: cashAccountKindSchema,
    status: cashAccountStatusSchema,
    allowNegativeBalance: z.boolean(),
    currency: cashCurrencyCodeSchema,
    currencyMinorUnitDigits: cashCurrencyMinorUnitDigitsSchema,
    balanceMinorUnits: signedCashAggregateMinorUnitsSchema,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const cashMovementSchema = z
  .object({
    id: uuidSchema,
    accountId: uuidSchema,
    direction: cashMovementDirectionSchema,
    action: cashMovementActionSchema,
    amountMinorUnits: cashPositiveMinorUnitsSchema,
    deltaMinorUnits: signedCashMinorUnitsSchema,
    currency: cashCurrencyCodeSchema,
    currencyMinorUnitDigits: cashCurrencyMinorUnitDigitsSchema,
    occurredAt: timestampSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
    timeZone: cashTimeZoneSchema,
    reason: z.string().min(1).max(240),
    expenseId: uuidSchema.nullable(),
    transferId: uuidSchema.nullable(),
    receivablePaymentId: uuidSchema.nullable(),
    reversalOfMovementId: uuidSchema.nullable(),
    createdAt: timestampSchema,
  })
  .strict();

export const cashTransferSchema = z
  .object({
    id: uuidSchema,
    fromAccountId: uuidSchema,
    toAccountId: uuidSchema,
    amountMinorUnits: cashPositiveMinorUnitsSchema,
    currency: cashCurrencyCodeSchema,
    currencyMinorUnitDigits: cashCurrencyMinorUnitDigitsSchema,
    occurredAt: timestampSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
    timeZone: cashTimeZoneSchema,
    note: z.string().min(1).max(240).nullable(),
    outMovementId: uuidSchema,
    inMovementId: uuidSchema,
    createdAt: timestampSchema,
  })
  .strict();

export const expenseSchema = z
  .object({
    id: uuidSchema,
    accountId: uuidSchema,
    status: expenseStatusSchema,
    category: expenseCategorySchema,
    amountMinorUnits: cashPositiveMinorUnitsSchema,
    currency: cashCurrencyCodeSchema,
    currencyMinorUnitDigits: cashCurrencyMinorUnitDigitsSchema,
    description: z.string().min(1).max(240),
    payee: z.string().min(1).max(120).nullable(),
    occurredAt: timestampSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
    timeZone: cashTimeZoneSchema,
    voidedAt: timestampSchema.nullable(),
    voidReason: z.string().min(1).max(240).nullable(),
    createdAt: timestampSchema,
  })
  .strict();

export const explicitOpeningSchema = z
  .object({
    direction: cashMovementDirectionSchema,
    amountMinorUnits: cashPositiveMinorUnitsSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
    reason: descriptionSchema,
  })
  .strict();

export const createCashAccountRequestSchema = z
  .object({
    idempotencyKey: cashIdempotencyKeySchema,
    name: accountNameSchema,
    kind: cashAccountKindSchema,
    allowNegativeBalance: z.boolean(),
    currency: cashCurrencyCodeSchema,
    opening: explicitOpeningSchema.nullable(),
  })
  .strict();

export const updateCashAccountRequestSchema = z
  .object({
    idempotencyKey: cashIdempotencyKeySchema,
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

export const archiveCashAccountRequestSchema = z
  .object({ idempotencyKey: cashIdempotencyKeySchema })
  .strict();

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
    cursor: cashCursorSchema.optional(),
    limit: boundedListLimitSchema,
    status: z.enum(["active", "archived", "all"]).default("active"),
  })
  .strict();

export const cashAccountListSchema = z
  .object({
    items: z.array(cashAccountSchema),
    nextCursor: cashCursorSchema.nullable(),
    queriedAt: timestampSchema,
  })
  .strict();

export const cashAccountListResponseSchema = z.object({ data: cashAccountListSchema }).strict();

export const postExpenseRequestSchema = z
  .object({
    idempotencyKey: cashIdempotencyKeySchema,
    accountId: uuidSchema,
    category: expenseCategorySchema,
    amountMinorUnits: cashPositiveMinorUnitsSchema,
    currency: cashCurrencyCodeSchema,
    description: descriptionSchema,
    payee: optionalPayeeSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
  })
  .strict();

export const voidExpenseRequestSchema = z
  .object({
    idempotencyKey: cashIdempotencyKeySchema,
    reason: descriptionSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
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
    cursor: cashCursorSchema.optional(),
    limit: boundedListLimitSchema,
    status: z.enum(["posted", "voided", "all"]).default("posted"),
    category: expenseCategorySchema.optional(),
    accountId: uuidSchema.optional(),
  })
  .strict();

export const expenseListSchema = z
  .object({
    items: z.array(expenseSchema),
    nextCursor: cashCursorSchema.nullable(),
    queriedAt: timestampSchema,
  })
  .strict();

export const expenseListResponseSchema = z.object({ data: expenseListSchema }).strict();

export const expensePeriodQuerySchema = z
  .object({
    startLocalDate: cashLocalDateSchema,
    endLocalDate: cashLocalDateSchema,
  })
  .strict();

export const expenseCategoryTotalSchema = z
  .object({
    category: expenseCategorySchema,
    amountMinorUnits: cashAggregateIntegerSchema,
    expenseCount: cashAggregateIntegerSchema,
  })
  .strict();

export const expensePeriodSummarySchema = z
  .object({
    periodStartLocal: cashLocalDateSchema,
    periodEndLocalInclusive: cashLocalDateSchema,
    periodStartUtc: timestampSchema,
    periodEndUtcExclusive: timestampSchema,
    timeZone: cashTimeZoneSchema,
    currency: cashCurrencyCodeSchema,
    currencyMinorUnitDigits: cashCurrencyMinorUnitDigitsSchema,
    totalMinorUnits: cashAggregateIntegerSchema,
    expenseCount: cashAggregateIntegerSchema,
    categories: z.array(expenseCategoryTotalSchema),
    queriedAt: timestampSchema,
  })
  .strict();

export const expensePeriodSummaryResponseSchema = z
  .object({ data: z.object({ summary: expensePeriodSummarySchema }).strict() })
  .strict();

export const recordCashAdjustmentRequestSchema = z
  .object({
    idempotencyKey: cashIdempotencyKeySchema,
    accountId: uuidSchema,
    direction: cashMovementDirectionSchema,
    amountMinorUnits: cashPositiveMinorUnitsSchema,
    currency: cashCurrencyCodeSchema,
    reason: descriptionSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
  })
  .strict();

export const reverseCashMovementRequestSchema = z
  .object({
    idempotencyKey: cashIdempotencyKeySchema,
    reason: descriptionSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
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
    cursor: cashCursorSchema.optional(),
    limit: boundedListLimitSchema,
    accountId: uuidSchema.optional(),
  })
  .strict();

export const cashMovementListSchema = z
  .object({
    items: z.array(cashMovementSchema),
    nextCursor: cashCursorSchema.nullable(),
    queriedAt: timestampSchema,
  })
  .strict();

export const cashMovementListResponseSchema = z.object({ data: cashMovementListSchema }).strict();

export const transferCashRequestSchema = z
  .object({
    idempotencyKey: cashIdempotencyKeySchema,
    fromAccountId: uuidSchema,
    toAccountId: uuidSchema,
    amountMinorUnits: cashPositiveMinorUnitsSchema,
    currency: cashCurrencyCodeSchema,
    occurredLocalDate: cashLocalDateSchema,
    occurredLocalTime: cashLocalTimeSchema,
    note: optionalNoteSchema,
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
export type PostExpenseRequest = z.infer<typeof postExpenseRequestSchema>;
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
