import {
  type AssistantDraft,
  type AssistantDraftKind,
  type AssistantField,
  type AssistantInterpretation,
  type AssistantInterpretRequest,
  type AssistantNotice,
  type AssistantSpan,
  assistantInterpretationSchema,
  type BusinessPermission,
} from "@pisto/contracts";

import { decimalToMinorUnits, lineSubtotal, positiveMinorUnits } from "./amounts.ts";
import { type DateExpression, resolveDate } from "./dates.ts";
import type {
  DirectoryAccount,
  DirectoryContext,
  DirectoryCustomer,
  DirectoryProduct,
  DirectorySupplier,
  RecordDirectory,
  SupplierDirectory,
} from "./directory.ts";
import { type Extraction, extractionJsonSchema, extractionSchema } from "./extraction.ts";
import { matchName, type NameMatch } from "./matching.ts";
import { extractionMessages } from "./prompt.ts";
import { type AssistantProvider, AssistantProviderError } from "./provider.ts";
import { findOccurrences, searchTerms } from "./text.ts";

/** Review fields of each record kind, in the order the review shows and numbers them. */
export const reviewFieldOrder: Record<AssistantDraftKind, readonly AssistantField[]> = {
  sale: [
    "kind",
    "date",
    "customer",
    "product",
    "quantity",
    "amount",
    "received",
    "paymentMethod",
    "account",
    "credit",
    "dueDate",
    "description",
  ],
  expense: [
    "kind",
    "date",
    "amount",
    "category",
    "description",
    "supplier",
    "paymentMethod",
    "account",
  ],
  purchase: [
    "kind",
    "date",
    "supplier",
    "invoice",
    "product",
    "quantity",
    "amount",
    "credit",
    "paymentMethod",
    "account",
    "dueDate",
  ],
  receivable_payment: ["kind", "date", "customer", "amount", "paymentMethod", "account"],
  supplier_payment: ["kind", "date", "supplier", "invoice", "amount", "paymentMethod", "account"],
};

/** The permissions the record's own command requires; the assistant only warns about them. */
const kindPermissions: Record<AssistantDraftKind, readonly BusinessPermission[]> = {
  sale: ["sales:create"],
  expense: ["expenses:manage"],
  purchase: ["purchases:manage"],
  receivable_payment: ["receivables:manage", "cash:manage"],
  supplier_payment: ["purchases:manage", "cash:manage"],
};

const maxSpans = 40;

export interface InterpretDependencies<Actor> {
  provider: AssistantProvider;
  records: RecordDirectory<Actor>;
  suppliers: SupplierDirectory<Actor>;
  /** Upper bound for the model call. */
  timeoutMs: number;
}

function notice(
  code: AssistantNotice["code"],
  field: AssistantField,
  lineIndex: number | null = null,
): AssistantNotice {
  return { code, field, lineIndex };
}

class Notices {
  readonly items: AssistantNotice[] = [];
  add(code: AssistantNotice["code"], field: AssistantField, lineIndex: number | null = null) {
    this.items.push(notice(code, field, lineIndex));
  }
  /** Not found, ambiguous and inexact matches each need the user's attention. */
  match(field: AssistantField, match: NameMatch<unknown>, lineIndex: number | null = null) {
    if (match.kind === "none") this.add("not_found", field, lineIndex);
    else if (match.kind === "ambiguous" || !match.exact)
      this.add("similar_match", field, lineIndex);
  }
}

function recordMatch<T extends { id: string; name: string }>(match: NameMatch<T>) {
  return match.kind === "matched"
    ? { id: match.record.id, name: match.record.name, exact: match.exact }
    : null;
}

function matchedRecord<T>(match: NameMatch<T>): T | null {
  return match.kind === "matched" ? match.record : null;
}

function text(value: string | null, maximum: number): string | null {
  return value === null ? null : value.slice(0, maximum);
}

/** Cash goes to a cash drawer; transfers and cards settle in a bank (or wallet) account. */
function accountFor(
  accounts: readonly DirectoryAccount[],
  method: Extraction["paymentMethod"],
): { id: string; name: string } | null {
  if (method === null) return null;
  const kinds: readonly DirectoryAccount["kind"][] =
    method === "cash" ? ["cash"] : method === "transfer" ? ["bank", "mobile_money"] : ["bank"];
  for (const kind of kinds) {
    const account = accounts.find((candidate) => candidate.kind === kind);
    if (account) return { id: account.id, name: account.name };
  }
  return null;
}

function occurrence(
  context: DirectoryContext,
  expression: DateExpression | null,
  notices: Notices,
) {
  const resolved = resolveDate(expression, context.localDate, "past");
  if (resolved.kind === "invalid") notices.add("missing", "date");
  return {
    occurredLocalDate: resolved.kind === "resolved" ? resolved.date : context.localDate,
    occurredLocalTime: context.localTime,
  };
}

function dueDate(
  context: DirectoryContext,
  expression: DateExpression | null,
  notices: Notices,
): string | null {
  const resolved = resolveDate(expression, context.localDate, "future");
  if (resolved.kind === "invalid") notices.add("missing", "dueDate");
  return resolved.kind === "resolved" ? resolved.date : null;
}

function buildLines(
  extraction: Extraction,
  products: readonly DirectoryProduct[],
  digits: number,
  price: "catalog" | "stated",
  notices: Notices,
) {
  return extraction.items.slice(0, 20).map((item, index) => {
    const match = matchName(item.name, products);
    notices.match("product", match, index);
    const product = matchedRecord(match);
    const precision = product?.quantityPrecision ?? null;
    const quantity = precision === null ? null : positiveMinorUnits(item.quantity, precision);
    const unitAmount =
      price === "catalog"
        ? product?.sellingPriceMinorUnits == null
          ? null
          : BigInt(product.sellingPriceMinorUnits)
        : decimalToMinorUnits(item.unitPrice, digits);
    if (product && quantity === null) notices.add("missing", "quantity", index);
    if (product && unitAmount === null) notices.add("missing", "amount", index);
    if (
      price === "catalog" &&
      product?.onHandMinorUnits != null &&
      quantity !== null &&
      quantity > BigInt(product.onHandMinorUnits)
    ) {
      notices.add("insufficient_stock", "quantity", index);
    }
    const subtotal =
      quantity !== null && unitAmount !== null && precision !== null
        ? lineSubtotal(quantity, precision, unitAmount)
        : null;
    return {
      heard: item.name,
      product: recordMatch(match),
      quantityMinorUnits: quantity?.toString() ?? null,
      quantityPrecision: precision,
      unitAmountMinorUnits: unitAmount?.toString() ?? null,
      subtotalMinorUnits: subtotal?.toString() ?? null,
    };
  });
}

/** Lines that all have a subtotal decide the total; otherwise the stated amount does. */
function totalOf(
  lines: ReadonlyArray<{ subtotalMinorUnits: string | null }>,
  stated: bigint | null,
): bigint | null {
  if (lines.length > 0 && lines.every((line) => line.subtotalMinorUnits !== null)) {
    return lines.reduce((sum, line) => sum + BigInt(line.subtotalMinorUnits as string), 0n);
  }
  return stated;
}

interface DraftInput {
  extraction: Extraction;
  context: DirectoryContext;
  products: readonly DirectoryProduct[];
  customers: readonly DirectoryCustomer[];
  accounts: readonly DirectoryAccount[];
  suppliers: readonly DirectorySupplier[];
  notices: Notices;
}

function saleDraft({ extraction, context, products, customers, accounts, notices }: DraftInput) {
  const digits = context.currencyMinorUnitDigits;
  const occurred = occurrence(context, extraction.date, notices);
  const customerMatch = matchName(extraction.party, customers);
  const lines = buildLines(extraction, products, digits, "catalog", notices);
  const total = totalOf(lines, positiveMinorUnits(extraction.amount, digits));
  if (total === null) notices.add("missing", "amount");

  let received = decimalToMinorUnits(extraction.received, digits);
  let credit: bigint | null = null;
  if (received !== null) {
    if (total !== null && received > total) notices.add("exceeds_total", "received");
    else if (total !== null) credit = total - received;
  } else if (extraction.settlement === "credit") {
    received = 0n;
    credit = total;
  } else if (extraction.settlement === "partial_credit") {
    notices.add("missing", "received");
  } else if (total !== null) {
    received = total;
    credit = 0n;
  }

  const owes = credit !== null && credit > 0n;
  if (extraction.party !== null) notices.match("customer", customerMatch);
  else if (owes || extraction.settlement === "credit") notices.add("missing", "customer");

  const paid = received !== null && received > 0n;
  const account = paid ? accountFor(accounts, extraction.paymentMethod) : null;
  if (paid && extraction.paymentMethod === null) notices.add("missing", "paymentMethod");
  else if (paid && account === null) notices.add("missing", "account");

  return {
    kind: "sale" as const,
    ...occurred,
    customer: { heard: extraction.party, match: recordMatch(customerMatch) },
    lines,
    totalMinorUnits: total?.toString() ?? null,
    receivedMinorUnits: received?.toString() ?? null,
    creditMinorUnits: credit?.toString() ?? null,
    paymentMethod: paid ? extraction.paymentMethod : null,
    account,
    dueDate: owes ? dueDate(context, extraction.dueDate, notices) : null,
    description: text(extraction.description, 240),
  };
}

function expenseDraft({ extraction, context, accounts, notices }: DraftInput) {
  const occurred = occurrence(context, extraction.date, notices);
  const amount = positiveMinorUnits(extraction.amount, context.currencyMinorUnitDigits);
  if (amount === null) notices.add("missing", "amount");
  if (extraction.category === null) notices.add("missing", "category");
  if (extraction.description === null) notices.add("missing", "description");
  const account = accountFor(accounts, extraction.paymentMethod);
  if (extraction.paymentMethod === null) notices.add("missing", "paymentMethod");
  else if (account === null) notices.add("missing", "account");
  return {
    kind: "expense" as const,
    ...occurred,
    category: extraction.category,
    amountMinorUnits: amount?.toString() ?? null,
    description: text(extraction.description, 240),
    payee: extraction.party,
    account,
  };
}

function purchaseDraft(input: DraftInput) {
  const { extraction, context, products, accounts, suppliers, notices } = input;
  const digits = context.currencyMinorUnitDigits;
  const occurred = occurrence(context, extraction.date, notices);
  const supplierMatch = matchName(extraction.party, suppliers);
  if (extraction.party === null) notices.add("missing", "supplier");
  else notices.match("supplier", supplierMatch);
  const lines = buildLines(extraction, products, digits, "stated", notices);
  const total = totalOf(lines, positiveMinorUnits(extraction.amount, digits));
  if (total === null) notices.add("missing", "amount");
  const paymentTerms =
    extraction.settlement === null ? null : extraction.settlement === "paid" ? "cash" : "credit";
  if (paymentTerms === null) notices.add("missing", "credit");
  const account = paymentTerms === "cash" ? accountFor(accounts, extraction.paymentMethod) : null;
  if (paymentTerms === "cash" && extraction.paymentMethod === null) {
    notices.add("missing", "paymentMethod");
  } else if (paymentTerms === "cash" && account === null) {
    notices.add("missing", "account");
  }
  return {
    kind: "purchase" as const,
    ...occurred,
    supplier: { heard: extraction.party, match: recordMatch(supplierMatch) },
    invoiceNumber: extraction.invoiceNumber,
    lines,
    totalMinorUnits: total?.toString() ?? null,
    paymentTerms,
    account,
    dueDate: paymentTerms === "credit" ? dueDate(context, extraction.dueDate, notices) : null,
    received: extraction.goodsReceived,
  } as const;
}

function receivablePaymentDraft({ extraction, context, customers, accounts, notices }: DraftInput) {
  const occurred = occurrence(context, extraction.date, notices);
  const match = matchName(extraction.party, customers);
  if (extraction.party === null) notices.add("missing", "customer");
  else notices.match("customer", match);
  const customer = matchedRecord(match);
  const receivable = customer?.oldestOpenReceivable ?? null;
  if (customer && receivable === null) notices.add("not_found", "credit");
  const amount = positiveMinorUnits(extraction.amount, context.currencyMinorUnitDigits);
  if (amount === null) notices.add("missing", "amount");
  else if (receivable && amount > BigInt(receivable.balanceMinorUnits)) {
    notices.add("exceeds_total", "amount");
  }
  const account = accountFor(accounts, extraction.paymentMethod);
  if (extraction.paymentMethod === null) notices.add("missing", "paymentMethod");
  else if (account === null) notices.add("missing", "account");
  return {
    kind: "receivable_payment" as const,
    ...occurred,
    customer: { heard: extraction.party, match: recordMatch(match) },
    receivable,
    amountMinorUnits: amount?.toString() ?? null,
    account,
  };
}

function supplierPaymentDraft({ extraction, context, suppliers, accounts, notices }: DraftInput) {
  const occurred = occurrence(context, extraction.date, notices);
  const match = matchName(extraction.party, suppliers);
  if (extraction.party === null) notices.add("missing", "supplier");
  else notices.match("supplier", match);
  const supplier = matchedRecord(match);
  const purchase = supplier?.oldestOpenPurchase ?? null;
  if (supplier && purchase === null) notices.add("not_found", "credit");
  const amount = positiveMinorUnits(extraction.amount, context.currencyMinorUnitDigits);
  if (amount === null) notices.add("missing", "amount");
  else if (purchase && amount > BigInt(purchase.balanceMinorUnits)) {
    notices.add("exceeds_total", "amount");
  }
  const account = accountFor(accounts, extraction.paymentMethod);
  if (extraction.paymentMethod === null) notices.add("missing", "paymentMethod");
  else if (account === null) notices.add("missing", "account");
  return {
    kind: "supplier_payment" as const,
    ...occurred,
    supplier: { heard: extraction.party, match: recordMatch(match) },
    purchase,
    amountMinorUnits: amount?.toString() ?? null,
    account,
  };
}

const builders: Record<AssistantDraftKind, (input: DraftInput) => AssistantDraft> = {
  sale: saleDraft,
  expense: expenseDraft,
  purchase: purchaseDraft,
  receivable_payment: receivablePaymentDraft,
  supplier_payment: supplierPaymentDraft,
};

/**
 * Locates each quoted fragment in the original text. Fragments that are not literally present,
 * overlap an earlier one, or belong to a field the record kind does not show are dropped; markers
 * number the remaining fields in review order.
 */
export function locateSpans(
  sentence: string,
  fragments: Extraction["fragments"],
  kind: AssistantDraftKind,
): AssistantSpan[] {
  const order = reviewFieldOrder[kind];
  const claimed: Array<{ start: number; end: number; field: AssistantField }> = [];
  for (const fragment of fragments) {
    if (!order.includes(fragment.field)) continue;
    const free = findOccurrences(sentence, fragment.text).find(
      ([start, end]) => !claimed.some((span) => start < span.end && span.start < end),
    );
    if (free) claimed.push({ start: free[0], end: free[1], field: fragment.field });
  }
  const fields = order.filter((field) => claimed.some((span) => span.field === field));
  return claimed
    .sort((left, right) => left.start - right.start)
    .slice(0, maxSpans)
    .map((span) => ({ ...span, marker: fields.indexOf(span.field) + 1 }));
}

/**
 * Turns one sentence into a reviewable draft. The model only extracts; names resolve to records of
 * the actor's active business, and money, dates, accounts and notices are computed here.
 */
export async function interpretSentence<Actor>(
  dependencies: InterpretDependencies<Actor>,
  actor: Actor,
  request: AssistantInterpretRequest,
): Promise<AssistantInterpretation> {
  const raw = await dependencies.provider.extract({
    messages: extractionMessages(request.text),
    jsonSchema: extractionJsonSchema,
    signal: AbortSignal.timeout(dependencies.timeoutMs),
  });
  const parsed = extractionSchema.safeParse(raw);
  if (!parsed.success) {
    throw new AssistantProviderError("invalid_output", "The model output does not fit the schema");
  }
  const extraction = parsed.data;
  if (extraction.kind === "none" || extraction.kind === "several") {
    return {
      text: request.text,
      source: request.source,
      spans: [],
      draft: null,
      unsupported: extraction.kind === "none" ? "not_a_record" : "several_records",
      notices: [],
    };
  }

  const kind = extraction.kind;
  const namesCustomer = kind === "sale" || kind === "receivable_payment";
  const namesSupplier = kind === "purchase" || kind === "supplier_payment";
  const party = extraction.party;
  const [lookup, suppliers] = await Promise.all([
    dependencies.records.lookup(actor, {
      products: extraction.items.flatMap((item) => searchTerms(item.name)),
      customers: namesCustomer && party ? searchTerms(party) : [],
    }),
    namesSupplier && party
      ? dependencies.suppliers.lookup(actor, searchTerms(party))
      : Promise.resolve([]),
  ]);

  const notices = new Notices();
  const draft = builders[kind]({
    extraction,
    context: lookup.context,
    products: lookup.products,
    customers: lookup.customers,
    accounts: lookup.accounts,
    suppliers,
    notices,
  });
  if (
    !kindPermissions[kind].every((permission) => lookup.context.permissions.includes(permission))
  ) {
    notices.add("not_permitted", "kind");
  }

  return assistantInterpretationSchema.parse({
    text: request.text,
    source: request.source,
    spans: locateSpans(request.text, extraction.fragments, kind),
    draft,
    unsupported: null,
    notices: notices.items.slice(0, 40),
  });
}
