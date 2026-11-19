import { assistantFieldSchema, expenseCategorySchema } from "@pisto/contracts";
import { z } from "zod";

import { weekdays } from "./dates.ts";

/**
 * What the model may return. It only transcribes what the user said into fields; every identifier,
 * price, total, account, date and permission is decided afterwards by deterministic server code.
 */
const extractedKinds = [
  "sale",
  "expense",
  "purchase",
  "receivable_payment",
  "supplier_payment",
  "none",
  "several",
] as const;

const withToolKinds = [...extractedKinds, "start_sale", "find_product"] as const;

const settlements = ["paid", "partial_credit", "credit"] as const;
const paymentMethods = ["cash", "transfer", "card"] as const;

/** A draft holds at most this many lines; the review numbers them. */
const maxItems = 20;

/**
 * Fields where "the model wrote something that does not fit" must not read as "the user did not say
 * it": an unread settlement would otherwise become a sale paid in full, and an unread date today.
 */
export type UnreadField = "date" | "dueDate" | "invoice" | "product" | "received" | "settlement";

/**
 * A malformed optional field becomes null instead of discarding everything else the model read
 * correctly. A null amount, name, category or payment method already produces a "missing" notice;
 * the fields in `UnreadField` are reported through `unread` because their null has another meaning.
 */
function extractionSchemaReporting(unread: (field: UnreadField) => void) {
  const reporting =
    <T>(field: UnreadField, fallback: T) =>
    () => {
      unread(field);
      return fallback;
    };
  const text = (maximum: number) => z.string().trim().min(1).max(maximum).nullable();
  const decimal = z
    .string()
    .trim()
    .regex(/^\d{1,15}(?:\.\d{1,6})?$/)
    .nullable();
  const dateExpression = (field: "date" | "dueDate") => {
    const part = (minimum: number, maximum: number) =>
      z.number().int().min(minimum).max(maximum).nullable().catch(reporting(field, null));
    return z
      .object({
        offsetDays: part(-366, 366),
        weekday: z.enum(weekdays).nullable().catch(reporting(field, null)),
        day: part(1, 31),
        month: part(1, 12),
        year: part(2000, 2100),
      })
      .nullable()
      .catch(reporting(field, null));
  };

  return z.object({
    kind: z.enum(withToolKinds),
    fragments: z
      .array(
        z
          .object({ text: z.string().trim().min(1).max(160), field: assistantFieldSchema })
          .nullable()
          .catch(null),
      )
      .catch([])
      .transform((fragments) => fragments.filter((fragment) => fragment !== null).slice(0, 40)),
    party: text(120).catch(null),
    items: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(120),
            quantity: decimal.catch(null),
            unitPrice: decimal.catch(null),
          })
          .nullable()
          .catch(reporting("product", null)),
      )
      .catch(reporting("product", []))
      .transform((items) => {
        const read = items.filter((item) => item !== null);
        if (read.length > maxItems) unread("product");
        return read.slice(0, maxItems);
      }),
    amount: decimal.catch(null),
    received: decimal.catch(reporting("received", null)),
    settlement: z.enum(settlements).nullable().catch(reporting("settlement", null)),
    paymentMethod: z.enum(paymentMethods).nullable().catch(null),
    goodsReceived: z.boolean().nullable().catch(null),
    date: dateExpression("date"),
    dueDate: dateExpression("dueDate"),
    category: expenseCategorySchema.nullable().catch(null),
    description: text(240).catch(null),
    invoiceNumber: text(40).catch(reporting("invoice", null)),
  });
}

export const extractionSchema = extractionSchemaReporting(() => undefined);

export type Extraction = z.infer<typeof extractionSchema>;

/** Parses model output, naming the fields it had to null; `null` when the output is not a record. */
export function readExtraction(
  raw: unknown,
): { extraction: Extraction; unread: ReadonlySet<UnreadField> } | null {
  const unread = new Set<UnreadField>();
  const parsed = extractionSchemaReporting((field) => unread.add(field)).safeParse(raw);
  return parsed.success ? { extraction: parsed.data, unread } : null;
}

/** An extraction that states nothing; the starting point of examples and test scripts. */
export const blankExtraction: Extraction = {
  kind: "none",
  fragments: [],
  party: null,
  items: [],
  amount: null,
  received: null,
  settlement: null,
  paymentMethod: null,
  goodsReceived: null,
  date: null,
  dueDate: null,
  category: null,
  description: null,
  invoiceNumber: null,
};

const nullable = (schema: Record<string, unknown>) => ({
  ...schema,
  type: [schema.type, "null"],
});
const dateExpression = nullable({
  type: "object",
  properties: {
    offsetDays: nullable({ type: "integer" }),
    weekday: { type: ["string", "null"], enum: [...weekdays, null] },
    day: nullable({ type: "integer" }),
    month: nullable({ type: "integer" }),
    year: nullable({ type: "integer" }),
  },
  required: ["offsetDays", "weekday", "day", "month", "year"],
  additionalProperties: false,
});
const nullableEnum = (values: readonly string[]) => ({
  type: ["string", "null"],
  enum: [...values, null],
});

/** JSON Schema sent as the provider's response format; it mirrors `extractionSchema`. */
export const extractionJsonSchema = {
  type: "object",
  properties: {
    kind: { type: "string", enum: [...extractedKinds] },
    fragments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          field: { type: "string", enum: [...assistantFieldSchema.options] },
        },
        required: ["text", "field"],
        additionalProperties: false,
      },
    },
    party: nullable({ type: "string" }),
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          quantity: nullable({ type: "string" }),
          unitPrice: nullable({ type: "string" }),
        },
        required: ["name", "quantity", "unitPrice"],
        additionalProperties: false,
      },
    },
    amount: nullable({ type: "string" }),
    received: nullable({ type: "string" }),
    settlement: nullableEnum(settlements),
    paymentMethod: nullableEnum(paymentMethods),
    goodsReceived: nullable({ type: "boolean" }),
    date: dateExpression,
    dueDate: dateExpression,
    category: nullableEnum(expenseCategorySchema.options),
    description: nullable({ type: "string" }),
    invoiceNumber: nullable({ type: "string" }),
  },
  required: [
    "kind",
    "fragments",
    "party",
    "items",
    "amount",
    "received",
    "settlement",
    "paymentMethod",
    "goodsReceived",
    "date",
    "dueDate",
    "category",
    "description",
    "invoiceNumber",
  ],
  additionalProperties: false,
} as const;

export const toolExtractionJsonSchema = {
  ...extractionJsonSchema,
  properties: { ...extractionJsonSchema.properties, kind: { type: "string", enum: withToolKinds } },
} as const;
