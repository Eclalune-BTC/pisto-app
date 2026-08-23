import { z } from "zod";

import {
  aggregateIntegerSchema,
  boundedListLimitSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  localDateSchema,
  localTimeSchema,
  opaqueCursorSchema,
  positiveMinorUnitsSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";

const nullableTrimmedText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();

export const pageCursorSchema = opaqueCursorSchema;
export const pageLimitSchema = boundedListLimitSchema;

export const customerStatusSchema = z.enum(["active", "archived"]);

export const customerSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  phone: z.string().min(1).max(40).nullable(),
  email: z.string().email().max(254).nullable(),
  notes: z.string().min(1).max(1_000).nullable(),
  status: customerStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const customerBalanceSchema = z.object({
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  outstandingMinorUnits: aggregateIntegerSchema,
  overdueMinorUnits: aggregateIntegerSchema,
  openReceivableCount: aggregateIntegerSchema,
  overdueReceivableCount: aggregateIntegerSchema,
  queriedAt: timestampSchema,
});

export const customerDetailSchema = z.object({
  customer: customerSchema,
  balance: customerBalanceSchema,
});

export const createCustomerRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    name: z.string().trim().min(1).max(120),
    phone: z.string().trim().min(1).max(40).optional(),
    email: z.string().trim().email().max(254).optional(),
    notes: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export const updateCustomerRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    name: z.string().trim().min(1).max(120).optional(),
    phone: nullableTrimmedText(40).optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    notes: nullableTrimmedText(1_000).optional(),
  })
  .strict()
  .refine(
    ({ email, name, notes, phone }) =>
      email !== undefined || name !== undefined || notes !== undefined || phone !== undefined,
    { message: "At least one customer field must be supplied" },
  );

export const archiveCustomerRequestSchema = z.object({ idempotencyKey: uuidSchema }).strict();

export const listCustomersQuerySchema = z
  .object({
    cursor: pageCursorSchema.optional(),
    limit: pageLimitSchema,
    query: z.string().trim().min(1).max(80).optional(),
    status: z.enum(["active", "archived", "all"]).default("active"),
  })
  .strict();

export const customerResponseSchema = z.object({
  data: z.object({ customer: customerSchema, replayed: z.boolean() }),
});

export const customerDetailResponseSchema = z.object({ data: customerDetailSchema });

export const customersResponseSchema = z.object({
  data: z.object({
    items: z.array(customerSchema),
    nextCursor: pageCursorSchema.nullable(),
  }),
});

export const receivableStateSchema = z.enum(["open", "paid", "overdue", "voided"]);

export const receivableSchema = z.object({
  id: uuidSchema,
  customerId: uuidSchema,
  state: receivableStateSchema,
  originalMinorUnits: positiveMinorUnitsSchema,
  paidMinorUnits: aggregateIntegerSchema,
  outstandingMinorUnits: aggregateIntegerSchema,
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  description: z.string().min(1).max(240),
  postedDate: localDateSchema,
  dueDate: localDateSchema.nullable(),
  voidedAt: timestampSchema.nullable(),
  voidReason: z.string().min(1).max(240).nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export const receivablePaymentKindSchema = z.enum(["payment", "reversal"]);

export const receivablePaymentSchema = z.object({
  id: uuidSchema,
  receivableId: uuidSchema,
  customerId: uuidSchema,
  kind: receivablePaymentKindSchema,
  amountMinorUnits: positiveMinorUnitsSchema,
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  occurredAt: timestampSchema,
  occurredLocalDate: localDateSchema,
  occurredLocalTime: localTimeSchema,
  timeZone: timeZoneSchema,
  cashAccountId: uuidSchema,
  reference: z.string().min(1).max(120).nullable(),
  reversesPaymentId: uuidSchema.nullable(),
  createdAt: timestampSchema,
});

export const postReceivableRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    customerId: uuidSchema,
    originalMinorUnits: positiveMinorUnitsSchema,
    description: z.string().trim().min(1).max(240),
    postedDate: localDateSchema,
    dueDate: localDateSchema.optional(),
  })
  .strict()
  .refine(({ dueDate, postedDate }) => dueDate === undefined || dueDate >= postedDate, {
    message: "The due date cannot be before the posted date",
    path: ["dueDate"],
  });

export const voidReceivableRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    reason: z.string().trim().min(1).max(240),
  })
  .strict();

export const applyReceivablePaymentRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    occurredLocalDate: localDateSchema,
    occurredLocalTime: localTimeSchema,
    cashAccountId: uuidSchema,
    reference: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const reverseReceivablePaymentRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    occurredLocalDate: localDateSchema,
    occurredLocalTime: localTimeSchema,
    reference: z.string().trim().min(1).max(120).optional(),
  })
  .strict();

export const listReceivablesQuerySchema = z
  .object({
    cursor: pageCursorSchema.optional(),
    customerId: uuidSchema.optional(),
    limit: pageLimitSchema,
    state: z.enum(["open", "paid", "overdue", "voided", "all"]).default("all"),
  })
  .strict();

export const receivableResponseSchema = z.object({
  data: z.object({ receivable: receivableSchema, replayed: z.boolean() }),
});

export const receivablePaymentResponseSchema = z.object({
  data: z.object({
    payment: receivablePaymentSchema,
    receivable: receivableSchema,
    replayed: z.boolean(),
  }),
});

export const receivableDetailResponseSchema = z.object({
  data: z.object({
    receivable: receivableSchema,
    payments: z.array(receivablePaymentSchema),
  }),
});

export const receivablesResponseSchema = z.object({
  data: z.object({
    items: z.array(receivableSchema),
    nextCursor: pageCursorSchema.nullable(),
  }),
});

export const receivablesSummarySchema = z.object({
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  outstandingMinorUnits: aggregateIntegerSchema,
  overdueMinorUnits: aggregateIntegerSchema,
  openReceivableCount: aggregateIntegerSchema,
  overdueReceivableCount: aggregateIntegerSchema,
  businessLocalDate: localDateSchema,
  timeZone: timeZoneSchema,
  queriedAt: timestampSchema,
});

export const receivablesSummaryResponseSchema = z.object({
  data: z.object({ summary: receivablesSummarySchema }),
});

export type Customer = z.infer<typeof customerSchema>;
export type CustomerBalance = z.infer<typeof customerBalanceSchema>;
export type CustomerDetail = z.infer<typeof customerDetailSchema>;
export type CreateCustomerRequest = z.infer<typeof createCustomerRequestSchema>;
export type UpdateCustomerRequest = z.infer<typeof updateCustomerRequestSchema>;
export type ArchiveCustomerRequest = z.infer<typeof archiveCustomerRequestSchema>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>;
export type CustomerResponse = z.infer<typeof customerResponseSchema>;
export type CustomerDetailResponse = z.infer<typeof customerDetailResponseSchema>;
export type CustomersResponse = z.infer<typeof customersResponseSchema>;
export type Receivable = z.infer<typeof receivableSchema>;
export type ReceivablePayment = z.infer<typeof receivablePaymentSchema>;
export type PostReceivableRequest = z.infer<typeof postReceivableRequestSchema>;
export type VoidReceivableRequest = z.infer<typeof voidReceivableRequestSchema>;
export type ApplyReceivablePaymentRequest = z.infer<typeof applyReceivablePaymentRequestSchema>;
export type ReverseReceivablePaymentRequest = z.infer<typeof reverseReceivablePaymentRequestSchema>;
export type ListReceivablesQuery = z.infer<typeof listReceivablesQuerySchema>;
export type ReceivableResponse = z.infer<typeof receivableResponseSchema>;
export type ReceivablePaymentResponse = z.infer<typeof receivablePaymentResponseSchema>;
export type ReceivableDetailResponse = z.infer<typeof receivableDetailResponseSchema>;
export type ReceivablesResponse = z.infer<typeof receivablesResponseSchema>;
export type ReceivablesSummary = z.infer<typeof receivablesSummarySchema>;
export type ReceivablesSummaryResponse = z.infer<typeof receivablesSummaryResponseSchema>;
