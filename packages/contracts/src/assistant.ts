import { z } from "zod";

import { cashAccountKindSchema, expenseCategorySchema } from "./cash";
import { productDetailResponseSchema, productUnitKindSchema } from "./catalog";
import { debtorsSchema } from "./debtors";
import {
  aggregateIntegerSchema,
  calendarLocalDateSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  localTimeSchema,
  minorUnitsSchema,
  positiveMinorUnitsSchema,
  signedAggregateIntegerSchema,
  timestampSchema,
  uuidSchema,
} from "./primitives";
import { payablesSummaryResponseSchema } from "./purchases";
import { reportExpenseCategoryFactsSchema } from "./reports";

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
    data: z
      .object({
        enabled: z.boolean(),
        transcription: z.boolean(),
        catalogConversation: z.boolean().optional(),
      })
      .strict(),
  })
  .strict();

export const assistantScopeHeader = "X-Pisto-Expected-Business";

/** Decimal quantities cross the UI boundary as text. The current product supplies their precision. */
export const catalogQuantitySchema = z
  .string()
  .max(20)
  .regex(/^(?:0|[1-9]\d{0,18})(?:\.\d{1,3})?$/)
  .refine((value) => /[1-9]/.test(value));

export const catalogTurnRequestSchema = z
  .object({
    expectedBusinessId: z.string().trim().min(1).max(256),
    productId: uuidSchema,
    text: z.string().trim().min(1).max(500),
    previousQuantity: catalogQuantitySchema.nullable(),
  })
  .strict();

const catalogReplySchema = z.union([
  z
    .object({ kind: z.enum(["price", "stock", "clarify", "quantity_needed", "missing_price"]) })
    .strict(),
  z
    .object({
      kind: z.enum(["quote", "prepare_sale"]),
      quantity: catalogQuantitySchema,
      quantityMinorUnits: positiveMinorUnitsSchema,
      totalMinorUnits: minorUnitsSchema,
    })
    .strict(),
]);
export const catalogTurnResponseSchema = z
  .object({
    data: productDetailResponseSchema.shape.data.extend({ reply: catalogReplySchema }).strict(),
  })
  .strict();
export type CatalogTurnRequest = z.infer<typeof catalogTurnRequestSchema>;
export type CatalogTurnResponse = z.infer<typeof catalogTurnResponseSchema>;
export type CatalogReply = z.infer<typeof catalogReplySchema>;

/** What a member can ask about the business. Each topic is one exact, authorized server read. */
export const businessTopicSchema = z.enum([
  "sales",
  "top_products",
  "expenses",
  "summary",
  "cash",
  "receivables",
  "payables",
  "low_stock",
]);

/** Calendar periods in the business time zone. A week starts on Monday. */
export const businessPeriodSchema = z.enum([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_7_days",
  "last_30_days",
]);

/** Topics that add up a period. The others are positions as of the read. */
export const periodBusinessTopics = [
  "sales",
  "top_products",
  "expenses",
  "summary",
] as const satisfies readonly z.infer<typeof businessTopicSchema>[];

export const maximumTopProducts = 5;
export const maximumLowStockProducts = 8;

export const businessAnswerQuerySchema = z
  .object({
    expectedBusinessId: z.string().trim().min(1).max(256),
    topic: businessTopicSchema,
    period: businessPeriodSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.period === undefined ||
      (periodBusinessTopics as readonly string[]).includes(value.topic),
    { message: "A current position takes no period", path: ["period"] },
  );

const answerPeriodSchema = z
  .object({
    key: businessPeriodSchema,
    startLocalDate: calendarLocalDateSchema,
    endLocalDate: calendarLocalDateSchema,
  })
  .strict();

const answerScope = {
  businessLocalDate: calendarLocalDateSchema,
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  queriedAt: timestampSchema,
};

/** Posted sales of a period. The average is rounded for display; gross and count stay exact. */
export const salesPeriodSummarySchema = z
  .object({
    grossMinorUnits: aggregateIntegerSchema,
    saleCount: aggregateIntegerSchema,
    averageMinorUnits: minorUnitsSchema.nullable(),
    /** Sales with product lines. A sale recorded by its total alone has no products to rank. */
    itemizedSaleCount: aggregateIntegerSchema,
    topProducts: z
      .array(
        z
          .object({
            productId: uuidSchema,
            name: z.string().min(1).max(120),
            unitKind: productUnitKindSchema,
            quantityPrecision: z.number().int().min(0).max(3),
            /** Null when the product's lines used more than one precision and cannot be added. */
            quantityMinorUnits: aggregateIntegerSchema.nullable(),
            grossMinorUnits: aggregateIntegerSchema,
          })
          .strict(),
      )
      .max(maximumTopProducts),
    ...answerScope,
  })
  .strict();

const payablesFacts = payablesSummaryResponseSchema.shape.data.shape;

export const businessAnswerSchema = z.discriminatedUnion("topic", [
  z
    .object({
      topic: z.literal("sales"),
      period: answerPeriodSchema,
      grossMinorUnits: aggregateIntegerSchema,
      saleCount: aggregateIntegerSchema,
      averageMinorUnits: minorUnitsSchema.nullable(),
      ...answerScope,
    })
    .strict(),
  z
    .object({
      topic: z.literal("top_products"),
      period: answerPeriodSchema,
      saleCount: aggregateIntegerSchema,
      itemizedSaleCount: aggregateIntegerSchema,
      products: salesPeriodSummarySchema.shape.topProducts,
      ...answerScope,
    })
    .strict(),
  z
    .object({
      topic: z.literal("expenses"),
      period: answerPeriodSchema,
      totalMinorUnits: aggregateIntegerSchema,
      expenseCount: aggregateIntegerSchema,
      categories: z.array(reportExpenseCategoryFactsSchema),
      ...answerScope,
    })
    .strict(),
  z
    .object({
      topic: z.literal("summary"),
      period: answerPeriodSchema,
      salesGrossMinorUnits: aggregateIntegerSchema,
      saleCount: aggregateIntegerSchema,
      expensesTotalMinorUnits: aggregateIntegerSchema,
      expenseCount: aggregateIntegerSchema,
      cashInflowMinorUnits: aggregateIntegerSchema,
      cashOutflowMinorUnits: aggregateIntegerSchema,
      ...answerScope,
    })
    .strict(),
  z
    .object({
      topic: z.literal("cash"),
      totalMinorUnits: signedAggregateIntegerSchema,
      activeAccountCount: aggregateIntegerSchema,
      kinds: z.array(
        z
          .object({
            kind: cashAccountKindSchema,
            accountCount: aggregateIntegerSchema,
            balanceMinorUnits: signedAggregateIntegerSchema,
          })
          .strict(),
      ),
      ...answerScope,
    })
    .strict(),
  z
    .object({
      topic: z.literal("receivables"),
      outstandingMinorUnits: aggregateIntegerSchema,
      overdueMinorUnits: aggregateIntegerSchema,
      customerCount: aggregateIntegerSchema,
      debtors: debtorsSchema.shape.items,
      ...answerScope,
    })
    .strict(),
  z
    .object({
      topic: z.literal("payables"),
      outstandingMinorUnits: payablesFacts.outstandingMinorUnits,
      dueSoonMinorUnits: payablesFacts.dueSoonMinorUnits,
      overdueMinorUnits: payablesFacts.overdueMinorUnits,
      openPurchaseCount: payablesFacts.openPurchaseCount,
      nextDue: payablesFacts.nextDue,
      ...answerScope,
    })
    .strict(),
  z
    .object({
      topic: z.literal("low_stock"),
      products: z
        .array(
          z
            .object({
              productId: uuidSchema,
              name: z.string().min(1).max(120),
              unitKind: productUnitKindSchema,
              quantityPrecision: z.number().int().min(0).max(3),
              onHandMinorUnits: aggregateIntegerSchema,
              lowStockThresholdMinorUnits: minorUnitsSchema,
            })
            .strict(),
        )
        .max(maximumLowStockProducts),
      /** True when more products are low than the ones listed. */
      more: z.boolean(),
      businessLocalDate: calendarLocalDateSchema,
    })
    .strict(),
]);

export const businessAnswerResponseSchema = z
  .object({ data: z.object({ answer: businessAnswerSchema }).strict() })
  .strict();

export type BusinessTopic = z.infer<typeof businessTopicSchema>;
export type BusinessPeriod = z.infer<typeof businessPeriodSchema>;
export type BusinessAnswerQuery = z.infer<typeof businessAnswerQuerySchema>;
export type BusinessAnswer = z.infer<typeof businessAnswerSchema>;
export type BusinessAnswerResponse = z.infer<typeof businessAnswerResponseSchema>;
export type SalesPeriodSummary = z.infer<typeof salesPeriodSummarySchema>;

export const assistantInterpretRequestSchema = z
  .object({
    text: z.string().trim().min(2).max(1_000),
    source: assistantInputSourceSchema,
    allowTools: z.literal(true).optional(),
    expectedBusinessId: z.string().trim().min(1).max(256).optional(),
  })
  .strict()
  .refine((value) => !value.allowTools || value.expectedBusinessId !== undefined, {
    message: "Tools require the expected active business",
  });

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
  /** The open purchase identified by the invoice, or the earliest due when no invoice was stated. */
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
      /** The total the user said differs from the sum of the priced lines. */
      "total_mismatch",
    ]),
    field: assistantFieldSchema,
    /** Index into `draft.lines` for product-line notices. */
    lineIndex: z.number().int().min(0).max(19).nullable(),
  })
  .strict();

export const assistantToolCallSchema = z.discriminatedUnion("name", [
  z.object({ name: z.literal("start_sale") }).strict(),
  z
    .object({
      name: z.literal("find_product"),
      query: z.string().trim().min(1).max(120).nullable(),
    })
    .strict(),
  z
    .object({
      name: z.literal("answer_question"),
      topic: businessTopicSchema,
      /** Null when the question names no period; the answer then states the one it used. */
      period: businessPeriodSchema.nullable(),
    })
    .strict(),
]);

export type AssistantToolCall = z.infer<typeof assistantToolCallSchema>;

export const assistantInterpretationSchema = z
  .object({
    text: z.string().min(2).max(1_000),
    source: assistantInputSourceSchema,
    spans: z.array(assistantSpanSchema).max(40),
    draft: assistantDraftSchema.nullable(),
    tool: assistantToolCallSchema.optional(),
    unsupported: z.enum(["not_a_record", "several_records", "partial_purchase_payment"]).nullable(),
    notices: z.array(assistantNoticeSchema).max(40),
  })
  .strict()
  .refine((value) => !value.tool || (value.draft === null && value.unsupported === null), {
    message: "A tool call cannot also be a record or a refusal",
  });

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
