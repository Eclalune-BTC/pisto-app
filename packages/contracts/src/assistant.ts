import { z } from "zod";

import { expenseCategorySchema } from "./cash";
import {
  calendarLocalDateSchema,
  localTimeSchema,
  minorUnitsSchema,
  positiveMinorUnitsSchema,
  uuidSchema,
} from "./primitives";

/**
 * The assistant turns one dictated or typed sentence into a draft of a record the user then reviews
 * and confirms through the record's own command. Nothing here writes a record.
 */
export const assistantDraftKindSchema = z.enum([
  "sale",
  "expense",
  "purchase",
  "receivable_payment",
  "supplier_payment",
]);

export const assistantInputSourceSchema = z.enum(["voice", "text"]);

export const assistantStatusResponseSchema = z
  .object({
    data: z.object({ enabled: z.boolean(), transcription: z.boolean() }).strict(),
  })
  .strict();

export const assistantInterpretRequestSchema = z
  .object({
    text: z.string().trim().min(2).max(1_000),
    source: assistantInputSourceSchema,
  })
  .strict();

/** Review fields a transcript fragment can be linked to. */
export const assistantFieldSchema = z.enum([
  "kind",
  "customer",
  "supplier",
  "product",
  "quantity",
  "amount",
  "received",
  "credit",
  "paymentMethod",
  "account",
  "date",
  "dueDate",
  "category",
  "description",
  "invoice",
]);

/** A server-located fragment of the original text; `marker` numbers it like its review field. */
export const assistantSpanSchema = z
  .object({
    start: z.number().int().min(0),
    end: z.number().int().min(1),
    field: assistantFieldSchema,
    marker: z.number().int().min(1).max(20),
  })
  .strict()
  .refine((span) => span.end > span.start, { message: "A span must not be empty" });

const recordMatchSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(120),
  /** False when the name only resembles what was heard and the user must confirm it. */
  exact: z.boolean(),
});

/** Who or what the user named, and the existing record it resolved to, if any. */
const namedPartySchema = z.object({
  heard: z.string().min(1).max(120).nullable(),
  match: recordMatchSchema.nullable(),
});

const accountChoiceSchema = z.object({ id: uuidSchema, name: z.string().min(1).max(80) });

const draftLineSchema = z.object({
  heard: z.string().min(1).max(120),
  product: recordMatchSchema.nullable(),
  quantityMinorUnits: positiveMinorUnitsSchema.nullable(),
  quantityPrecision: z.number().int().min(0).max(3).nullable(),
  /** Unit price for a sale, unit cost for a purchase. */
  unitAmountMinorUnits: minorUnitsSchema.nullable(),
  subtotalMinorUnits: minorUnitsSchema.nullable(),
});

const occurrenceFields = {
  occurredLocalDate: calendarLocalDateSchema,
  occurredLocalTime: localTimeSchema,
};

export const assistantSaleDraftSchema = z.object({
  kind: z.literal("sale"),
  ...occurrenceFields,
  customer: namedPartySchema,
  lines: z.array(draftLineSchema).max(20),
  totalMinorUnits: minorUnitsSchema.nullable(),
  receivedMinorUnits: minorUnitsSchema.nullable(),
  creditMinorUnits: minorUnitsSchema.nullable(),
  paymentMethod: z.enum(["cash", "transfer", "card"]).nullable(),
  account: accountChoiceSchema.nullable(),
  dueDate: calendarLocalDateSchema.nullable(),
  description: z.string().min(1).max(240).nullable(),
});

export const assistantExpenseDraftSchema = z.object({
  kind: z.literal("expense"),
  ...occurrenceFields,
  category: expenseCategorySchema.nullable(),
  amountMinorUnits: positiveMinorUnitsSchema.nullable(),
  description: z.string().min(1).max(240).nullable(),
  payee: z.string().min(1).max(120).nullable(),
  account: accountChoiceSchema.nullable(),
});

export const assistantPurchaseDraftSchema = z.object({
  kind: z.literal("purchase"),
  ...occurrenceFields,
  supplier: namedPartySchema,
  invoiceNumber: z.string().min(1).max(40).nullable(),
  lines: z.array(draftLineSchema).max(20),
  totalMinorUnits: minorUnitsSchema.nullable(),
  paymentTerms: z.enum(["cash", "credit"]).nullable(),
  account: accountChoiceSchema.nullable(),
  dueDate: calendarLocalDateSchema.nullable(),
  received: z.boolean().nullable(),
});

export const assistantReceivablePaymentDraftSchema = z.object({
  kind: z.literal("receivable_payment"),
  ...occurrenceFields,
  customer: namedPartySchema,
  /** The customer's oldest open receivable, which the payment would be applied to. */
  receivable: z
    .object({
      id: uuidSchema,
      description: z.string().min(1).max(240),
      balanceMinorUnits: positiveMinorUnitsSchema,
    })
    .nullable(),
  amountMinorUnits: positiveMinorUnitsSchema.nullable(),
  account: accountChoiceSchema.nullable(),
});

export const assistantSupplierPaymentDraftSchema = z.object({
  kind: z.literal("supplier_payment"),
  ...occurrenceFields,
  supplier: namedPartySchema,
  /** The supplier's oldest purchase with a balance, which the payment would be applied to. */
  purchase: z
    .object({
      id: uuidSchema,
      invoiceNumber: z.string().min(1).max(40).nullable(),
      balanceMinorUnits: positiveMinorUnitsSchema,
    })
    .nullable(),
  amountMinorUnits: positiveMinorUnitsSchema.nullable(),
  account: accountChoiceSchema.nullable(),
});

export const assistantDraftSchema = z.discriminatedUnion("kind", [
  assistantSaleDraftSchema,
  assistantExpenseDraftSchema,
  assistantPurchaseDraftSchema,
  assistantReceivablePaymentDraftSchema,
  assistantSupplierPaymentDraftSchema,
]);

/** Something the user must look at before confirming; the app words it. */
export const assistantNoticeSchema = z
  .object({
    code: z.enum([
      "missing",
      "not_found",
      "similar_match",
      "exceeds_total",
      "insufficient_stock",
      "not_permitted",
    ]),
    field: assistantFieldSchema,
    /** Index into `draft.lines` for product-line notices. */
    lineIndex: z.number().int().min(0).max(19).nullable(),
  })
  .strict();

export const assistantInterpretationSchema = z
  .object({
    text: z.string().min(2).max(1_000),
    source: assistantInputSourceSchema,
    spans: z.array(assistantSpanSchema).max(40),
    draft: assistantDraftSchema.nullable(),
    /** Set when `draft` is null. */
    unsupported: z.enum(["not_a_record", "several_records"]).nullable(),
    notices: z.array(assistantNoticeSchema).max(40),
  })
  .strict();

export const assistantInterpretResponseSchema = z
  .object({ data: z.object({ interpretation: assistantInterpretationSchema }).strict() })
  .strict();

/** Audio is sent as the raw request body; this is what comes back. */
export const assistantTranscriptionResponseSchema = z
  .object({ data: z.object({ text: z.string().max(2_000) }).strict() })
  .strict();

export type AssistantDraftKind = z.infer<typeof assistantDraftKindSchema>;
export type AssistantInputSource = z.infer<typeof assistantInputSourceSchema>;
export type AssistantStatusResponse = z.infer<typeof assistantStatusResponseSchema>;
export type AssistantInterpretRequest = z.infer<typeof assistantInterpretRequestSchema>;
export type AssistantField = z.infer<typeof assistantFieldSchema>;
export type AssistantSpan = z.infer<typeof assistantSpanSchema>;
export type AssistantSaleDraft = z.infer<typeof assistantSaleDraftSchema>;
export type AssistantExpenseDraft = z.infer<typeof assistantExpenseDraftSchema>;
export type AssistantPurchaseDraft = z.infer<typeof assistantPurchaseDraftSchema>;
export type AssistantReceivablePaymentDraft = z.infer<typeof assistantReceivablePaymentDraftSchema>;
export type AssistantSupplierPaymentDraft = z.infer<typeof assistantSupplierPaymentDraftSchema>;
export type AssistantDraft = z.infer<typeof assistantDraftSchema>;
export type AssistantNotice = z.infer<typeof assistantNoticeSchema>;
export type AssistantInterpretation = z.infer<typeof assistantInterpretationSchema>;
export type AssistantInterpretResponse = z.infer<typeof assistantInterpretResponseSchema>;
export type AssistantTranscriptionResponse = z.infer<typeof assistantTranscriptionResponseSchema>;
