import { z } from "zod";

import {
  aggregateIntegerSchema,
  boundedListLimitSchema,
  calendarLocalDateSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  entrySourceSchema,
  localTimeSchema,
  minorUnitsSchema,
  opaqueCursorSchema,
  positiveMinorUnitsSchema,
  shortRequestTextSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";

const nullableTrimmedText = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();

export const supplierStatusSchema = z.enum(["active", "archived"]);

export const supplierSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  contactName: z.string().min(1).max(120).nullable(),
  phone: z.string().min(1).max(40).nullable(),
  email: z.string().email().max(254).nullable(),
  taxId: z.string().min(1).max(40).nullable(),
  creditDays: z.number().int().min(0).max(365).nullable(),
  notes: z.string().min(1).max(1_000).nullable(),
  status: supplierStatusSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

const supplierBalanceSchema = z.object({
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  outstandingMinorUnits: aggregateIntegerSchema,
  overdueMinorUnits: aggregateIntegerSchema,
  openPurchaseCount: aggregateIntegerSchema,
  lastPurchaseLocalDate: calendarLocalDateSchema.nullable(),
  queriedAt: timestampSchema,
});

export const createSupplierRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    name: z.string().trim().min(1).max(120),
    contactName: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().min(1).max(40).optional(),
    email: z.string().trim().email().max(254).optional(),
    taxId: z.string().trim().min(1).max(40).optional(),
    creditDays: z.number().int().min(0).max(365).optional(),
    notes: z.string().trim().min(1).max(1_000).optional(),
  })
  .strict();

export const updateSupplierRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    name: z.string().trim().min(1).max(120).optional(),
    contactName: nullableTrimmedText(120).optional(),
    phone: nullableTrimmedText(40).optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
    taxId: nullableTrimmedText(40).optional(),
    creditDays: z.number().int().min(0).max(365).nullable().optional(),
    notes: nullableTrimmedText(1_000).optional(),
  })
  .strict()
  .refine((fields) => Object.keys(fields).some((key) => key !== "idempotencyKey"), {
    message: "At least one supplier field must be supplied",
  });

export const archiveSupplierRequestSchema = z.object({ idempotencyKey: uuidSchema }).strict();

export const listSuppliersQuerySchema = z
  .object({
    cursor: opaqueCursorSchema.optional(),
    limit: boundedListLimitSchema,
    query: z.string().trim().min(1).max(80).optional(),
    status: z.enum(["active", "archived", "all"]).default("active"),
    /** `outstanding` keeps the suppliers the business still owes. */
    balance: z.enum(["all", "outstanding"]).default("all"),
  })
  .strict();

export const supplierResponseSchema = z
  .object({ data: z.object({ supplier: supplierSchema, replayed: z.boolean() }).strict() })
  .strict();

export const supplierDetailResponseSchema = z
  .object({
    data: z.object({ supplier: supplierSchema, balance: supplierBalanceSchema }).strict(),
  })
  .strict();

export const supplierListResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(supplierSchema.extend({ balance: supplierBalanceSchema })),
        nextCursor: opaqueCursorSchema.nullable(),
        queriedAt: timestampSchema,
      })
      .strict(),
  })
  .strict();

/** `cash` is paid on the spot from one account; `credit` opens a payable for the whole total. */
export const purchasePaymentTermsSchema = z.enum(["cash", "credit"]);
export const purchaseStatusSchema = z.enum(["posted", "voided"]);
export const payableStateSchema = z.enum(["paid", "open", "due_soon", "overdue"]);

const purchaseLineRequestSchema = z
  .object({
    productId: uuidSchema,
    /** Scaled by the product's quantityPrecision, like inventory movements. */
    quantityMinorUnits: positiveMinorUnitsSchema,
    unitCostMinorUnits: minorUnitsSchema,
  })
  .strict();

export const purchaseLineSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  productName: z.string().min(1).max(120),
  quantityMinorUnits: positiveMinorUnitsSchema,
  quantityPrecision: z.number().int().min(0).max(3),
  unitCostMinorUnits: minorUnitsSchema,
  subtotalMinorUnits: minorUnitsSchema,
});

export const purchaseSchema = z.object({
  id: uuidSchema,
  supplierId: uuidSchema,
  supplierName: z.string().min(1).max(120),
  invoiceNumber: z.string().min(1).max(40).nullable(),
  status: purchaseStatusSchema,
  entrySource: entrySourceSchema,
  paymentTerms: purchasePaymentTermsSchema,
  received: z.boolean(),
  receivedAt: timestampSchema.nullable(),
  totalMinorUnits: positiveMinorUnitsSchema,
  paidMinorUnits: minorUnitsSchema,
  balanceMinorUnits: minorUnitsSchema,
  payableState: payableStateSchema,
  dueDate: calendarLocalDateSchema.nullable(),
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  occurredAt: timestampSchema,
  occurredLocalDate: calendarLocalDateSchema,
  occurredLocalTime: localTimeSchema,
  timeZone: timeZoneSchema,
  note: z.string().min(1).max(240).nullable(),
  lines: z.array(purchaseLineSchema).min(1),
  createdAt: timestampSchema,
});

export const createPurchaseRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    supplierId: uuidSchema,
    invoiceNumber: z.string().trim().min(1).max(40).optional(),
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    lines: z.array(purchaseLineRequestSchema).min(1).max(50),
    /** Received merchandise enters inventory now; otherwise through the receive command. */
    received: z.boolean(),
    paymentTerms: purchasePaymentTermsSchema,
    /** Required for `cash` terms: the account the total leaves from. */
    accountId: uuidSchema.optional(),
    /** Required for `credit` terms. */
    dueDate: calendarLocalDateSchema.optional(),
    note: shortRequestTextSchema.optional(),
    entrySource: entrySourceSchema.default("manual"),
  })
  .strict()
  .refine((request) => request.paymentTerms !== "cash" || request.accountId !== undefined, {
    message: "A cash purchase needs the account it is paid from",
    path: ["accountId"],
  })
  .refine((request) => request.paymentTerms !== "credit" || request.dueDate !== undefined, {
    message: "A credit purchase needs a due date",
    path: ["dueDate"],
  });

export const receivePurchaseRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
  })
  .strict();

export const voidPurchaseRequestSchema = z
  .object({ idempotencyKey: uuidSchema, reason: z.string().trim().min(2).max(240) })
  .strict();

export const supplierPaymentSchema = z.object({
  id: uuidSchema,
  purchaseId: uuidSchema,
  supplierId: uuidSchema,
  accountId: uuidSchema,
  amountMinorUnits: positiveMinorUnitsSchema,
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  occurredAt: timestampSchema,
  occurredLocalDate: calendarLocalDateSchema,
  occurredLocalTime: localTimeSchema,
  timeZone: timeZoneSchema,
  reference: z.string().min(1).max(120).nullable(),
  entrySource: entrySourceSchema,
  createdAt: timestampSchema,
});

export const createSupplierPaymentRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    accountId: uuidSchema,
    amountMinorUnits: positiveMinorUnitsSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    reference: z.string().trim().min(1).max(120).optional(),
    entrySource: entrySourceSchema.default("manual"),
  })
  .strict();

export const purchaseResponseSchema = z
  .object({ data: z.object({ purchase: purchaseSchema, replayed: z.boolean() }).strict() })
  .strict();

export const purchaseDetailResponseSchema = z
  .object({
    data: z.object({ purchase: purchaseSchema, payments: z.array(supplierPaymentSchema) }).strict(),
  })
  .strict();

export const supplierPaymentResponseSchema = z
  .object({
    data: z
      .object({
        payment: supplierPaymentSchema,
        purchase: purchaseSchema,
        replayed: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const listPurchasesQuerySchema = z
  .object({
    cursor: opaqueCursorSchema.optional(),
    limit: boundedListLimitSchema,
    supplierId: uuidSchema.optional(),
    /** `open` lists purchases with a balance, the accounts-payable view. */
    payable: z.enum(["open", "paid", "all"]).default("all"),
    status: z.enum(["posted", "voided", "all"]).default("posted"),
  })
  .strict();

export const purchaseListResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(purchaseSchema),
        nextCursor: opaqueCursorSchema.nullable(),
        queriedAt: timestampSchema,
      })
      .strict(),
  })
  .strict();

export const payablesSummaryResponseSchema = z
  .object({
    data: z
      .object({
        currency: currencyCodeSchema,
        currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
        outstandingMinorUnits: aggregateIntegerSchema,
        dueSoonMinorUnits: aggregateIntegerSchema,
        overdueMinorUnits: aggregateIntegerSchema,
        openPurchaseCount: aggregateIntegerSchema,
        nextDue: z
          .object({
            purchaseId: uuidSchema,
            supplierName: z.string().min(1).max(120),
            dueDate: calendarLocalDateSchema,
            balanceMinorUnits: positiveMinorUnitsSchema,
          })
          .nullable(),
        businessLocalDate: calendarLocalDateSchema,
        queriedAt: timestampSchema,
      })
      .strict(),
  })
  .strict();

export type Supplier = z.infer<typeof supplierSchema>;
export type SupplierStatus = z.infer<typeof supplierStatusSchema>;
export type CreateSupplierRequest = z.infer<typeof createSupplierRequestSchema>;
export type UpdateSupplierRequest = z.infer<typeof updateSupplierRequestSchema>;
export type ArchiveSupplierRequest = z.infer<typeof archiveSupplierRequestSchema>;
export type ListSuppliersQuery = z.input<typeof listSuppliersQuerySchema>;
export type SupplierResponse = z.infer<typeof supplierResponseSchema>;
export type SupplierDetailResponse = z.infer<typeof supplierDetailResponseSchema>;
export type SupplierListResponse = z.infer<typeof supplierListResponseSchema>;
export type PurchasePaymentTerms = z.infer<typeof purchasePaymentTermsSchema>;
export type PayableState = z.infer<typeof payableStateSchema>;
export type PurchaseLine = z.infer<typeof purchaseLineSchema>;
export type Purchase = z.infer<typeof purchaseSchema>;
export type CreatePurchaseRequest = z.input<typeof createPurchaseRequestSchema>;
export type ReceivePurchaseRequest = z.infer<typeof receivePurchaseRequestSchema>;
export type VoidPurchaseRequest = z.infer<typeof voidPurchaseRequestSchema>;
export type SupplierPayment = z.infer<typeof supplierPaymentSchema>;
export type CreateSupplierPaymentRequest = z.input<typeof createSupplierPaymentRequestSchema>;
export type PurchaseResponse = z.infer<typeof purchaseResponseSchema>;
export type PurchaseDetailResponse = z.infer<typeof purchaseDetailResponseSchema>;
export type SupplierPaymentResponse = z.infer<typeof supplierPaymentResponseSchema>;
export type ListPurchasesQuery = z.input<typeof listPurchasesQuerySchema>;
export type PurchaseListResponse = z.infer<typeof purchaseListResponseSchema>;
export type PayablesSummaryResponse = z.infer<typeof payablesSummaryResponseSchema>;
