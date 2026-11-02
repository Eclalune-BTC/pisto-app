import { assistantFieldSchema, expenseCategorySchema } from "@pisto/contracts";
import { z } from "zod";

import { weekdays } from "./dates.ts";

/**
 * What the model may return. It only transcribes what the user said into fields; every identifier,
 * price, total, account, date and permission is decided afterwards by deterministic server code.
 */
export const extractedKinds = [
  "sale",
  "expense",
  "purchase",
  "receivable_payment",
  "supplier_payment",
  "none",
  "several",
] as const;

const settlements = ["paid", "partial_credit", "credit"] as const;
const paymentMethods = ["cash", "transfer", "card"] as const;

// A malformed optional field becomes null (and later a "missing" notice) instead of discarding
// everything else the model read correctly.
const text = (maximum: number) => z.string().trim().min(1).max(maximum).nullable().catch(null);
const decimal = z
  .string()
  .trim()
  .regex(/^\d{1,15}(?:\.\d{1,6})?$/)
  .nullable()
  .catch(null);
const smallInteger = (minimum: number, maximum: number) =>
  z.number().int().min(minimum).max(maximum).nullable().catch(null);

const dateExpressionSchema = z
  .object({
    offsetDays: smallInteger(-366, 366),
    weekday: z.enum(weekdays).nullable().catch(null),
    day: smallInteger(1, 31),
    month: smallInteger(1, 12),
    year: smallInteger(2000, 2100),
  })
  .nullable()
  .catch(null);

export const extractionSchema = z.object({
  kind: z.enum(extractedKinds),
  fragments: z
    .array(
      z
        .object({ text: z.string().trim().min(1).max(160), field: assistantFieldSchema })
        .nullable()
        .catch(null),
    )
    .max(40)
    .catch([])
    .transform((fragments) => fragments.filter((fragment) => fragment !== null)),
  party: text(120),
  items: z
    .array(
      z
        .object({ name: z.string().trim().min(1).max(120), quantity: decimal, unitPrice: decimal })
        .nullable()
        .catch(null),
    )
    .max(20)
    .catch([])
    .transform((items) => items.filter((item) => item !== null)),
  amount: decimal,
  received: decimal,
  settlement: z.enum(settlements).nullable().catch(null),
  paymentMethod: z.enum(paymentMethods).nullable().catch(null),
  goodsReceived: z.boolean().nullable().catch(null),
  date: dateExpressionSchema,
  dueDate: dateExpressionSchema,
  category: expenseCategorySchema.nullable().catch(null),
  description: text(240),
  invoiceNumber: text(40),
});

export type Extraction = z.infer<typeof extractionSchema>;

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
