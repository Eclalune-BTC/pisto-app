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

import { decimalToMinorUnits, lineSubtotal, positiveMinorUnits, withinRange } from "./amounts.ts";
import { resolveDate } from "./dates.ts";
import type {
  DirectoryAccount,
  DirectoryContext,
  DirectoryCustomer,
  DirectoryProduct,
  DirectorySupplier,
  RecordDirectory,
  SupplierDirectory,
} from "./directory.ts";
import {
  type Extraction,
  extractionJsonSchema,
  readExtraction,
  toolExtractionJsonSchema,
  type UnreadField,
} from "./extraction.ts";
import { matchName, type NameMatch } from "./matching.ts";
import { paymentInvoice } from "./payment-invoice.ts";
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
const maxNotices = 40;

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
  /** Notices about the whole record are kept before those of one line when the list is full. */
  capped(): AssistantNotice[] {
    if (this.items.length <= maxNotices) return this.items;
    return [
      ...this.items.filter((item) => item.lineIndex === null),
      ...this.items.filter((item) => item.lineIndex !== null),
    ].slice(0, maxNotices);
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

/**
 * The account a payment method settles in: cash goes to a cash drawer; transfers and cards settle
 * in a bank (or wallet) account. The sentence never names the account, so when the business has
 * more than one of that kind the oldest is proposed and the user is asked to confirm it.
 */
function paymentAccount(
  accounts: readonly DirectoryAccount[],
  method: Extraction["paymentMethod"],
  notices: Notices,
): { id: string; name: string } | null {
  if (method === null) {
    notices.add("missing", "paymentMethod");
    return null;
  }
  const kinds: readonly DirectoryAccount["kind"][] =
    method === "cash" ? ["cash"] : method === "transfer" ? ["bank", "mobile_money"] : ["bank"];
  for (const kind of kinds) {
    const [account, another] = accounts.filter((candidate) => candidate.kind === kind);
    if (!account) continue;
    if (another) notices.add("similar_match", "account");
    return { id: account.id, name: account.name };
  }
  notices.add("missing", "account");
  return null;
}

function occurrence({ context, extraction, notices, unread }: DraftInput) {
  // A date the model wrote but that could not be read is not "today by default": the user is told.
  const resolved = unread.has("date")
    ? ({ kind: "invalid" } as const)
    : resolveDate(extraction.date, context.localDate, "past");
  if (resolved.kind === "invalid") notices.add("missing", "date");
  return {
    occurredLocalDate: resolved.kind === "resolved" ? resolved.date : context.localDate,
    occurredLocalTime: context.localTime,
  };
}

function dueDate({ context, extraction, notices, unread }: DraftInput): string | null {
  const resolved = unread.has("dueDate")
    ? ({ kind: "invalid" } as const)
    : resolveDate(extraction.dueDate, context.localDate, "future");
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
  return extraction.items.map((item, index) => {
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
    // A sale charges the catalog price; a different price the user said must be set by hand.
    const statedUnit = decimalToMinorUnits(item.unitPrice, digits);
    if (
      price === "catalog" &&
      unitAmount !== null &&
      statedUnit !== null &&
      statedUnit !== unitAmount
    ) {
      notices.add("total_mismatch", "amount", index);
    }
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

/**
 * What the user said the total was wins, because received and credit follow it; when the priced
 * lines add up to something else the user is told to fix the prices. Without a stated total, lines
 * that all have a subtotal decide it.
 */
function totalOf(
  lines: ReadonlyArray<{ subtotalMinorUnits: string | null }>,
  stated: bigint | null,
  notices: Notices,
): bigint | null {
  const priced = lines.length > 0 && lines.every((line) => line.subtotalMinorUnits !== null);
  const computed = priced
    ? withinRange(lines.reduce((sum, line) => sum + BigInt(line.subtotalMinorUnits as string), 0n))
    : null;
  if (stated !== null && computed !== null && stated !== computed) {
    notices.add("total_mismatch", "amount");
  }
  return stated ?? computed;
}

interface DraftInput {
  extraction: Extraction;
  context: DirectoryContext;
  products: readonly DirectoryProduct[];
  customers: readonly DirectoryCustomer[];
  accounts: readonly DirectoryAccount[];
  suppliers: readonly DirectorySupplier[];
  notices: Notices;
  /** Fields the model wrote but that did not fit; they are asked for, never defaulted. */
  unread: ReadonlySet<UnreadField>;
}

function saleDraft(input: DraftInput) {
  const { extraction, context, products, customers, accounts, notices, unread } = input;
  const digits = context.currencyMinorUnitDigits;
  const occurred = occurrence(input);
  const customerMatch = matchName(extraction.party, customers);
  const lines = buildLines(extraction, products, digits, "catalog", notices);
  if (unread.has("product")) notices.add("missing", "product");
  const total = totalOf(lines, positiveMinorUnits(extraction.amount, digits), notices);
  if (total === null) notices.add("missing", "amount");

  let received = decimalToMinorUnits(extraction.received, digits);
  let credit: bigint | null = null;
  if (received !== null) {
    if (total !== null && received > total) notices.add("exceeds_total", "received");
    else if (total !== null) credit = total - received;
  } else if (unread.has("received") || unread.has("settlement")) {
    // How it was paid was said but not read, so the draft cannot claim it was paid in full.
    notices.add("missing", "received");
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
  const account = paid ? paymentAccount(accounts, extraction.paymentMethod, notices) : null;

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
    dueDate: owes ? dueDate(input) : null,
    description: extraction.description,
  };
}

function expenseDraft(input: DraftInput) {
  const { extraction, context, accounts, notices } = input;
  const occurred = occurrence(input);
  const amount = positiveMinorUnits(extraction.amount, context.currencyMinorUnitDigits);
  if (amount === null) notices.add("missing", "amount");
  if (extraction.category === null) notices.add("missing", "category");
  if (extraction.description === null) notices.add("missing", "description");
  const account = paymentAccount(accounts, extraction.paymentMethod, notices);
  return {
    kind: "expense" as const,
    ...occurred,
    category: extraction.category,
    amountMinorUnits: amount?.toString() ?? null,
    description: extraction.description,
    payee: extraction.party,
    account,
  };
}

function purchaseDraft(input: DraftInput) {
  const { extraction, context, products, accounts, suppliers, notices, unread } = input;
  const digits = context.currencyMinorUnitDigits;
  const occurred = occurrence(input);
  const supplierMatch = matchName(extraction.party, suppliers);
  if (extraction.party === null) notices.add("missing", "supplier");
  else notices.match("supplier", supplierMatch);
  if (unread.has("invoice")) notices.add("missing", "invoice");
  const lines = buildLines(extraction, products, digits, "stated", notices);
  if (unread.has("product")) notices.add("missing", "product");
  const total = totalOf(lines, positiveMinorUnits(extraction.amount, digits), notices);
  if (total === null) notices.add("missing", "amount");
  const paymentTerms =
    extraction.settlement === null ? null : extraction.settlement === "paid" ? "cash" : "credit";
  if (paymentTerms === null) notices.add("missing", "credit");
  const account =
    paymentTerms === "cash" ? paymentAccount(accounts, extraction.paymentMethod, notices) : null;
  return {
    kind: "purchase" as const,
    ...occurred,
    supplier: { heard: extraction.party, match: recordMatch(supplierMatch) },
    invoiceNumber: extraction.invoiceNumber,
    lines,
    totalMinorUnits: total?.toString() ?? null,
    paymentTerms,
    account,
    dueDate: paymentTerms === "credit" ? dueDate(input) : null,
    received: extraction.goodsReceived,
  } as const;
}

function receivablePaymentDraft(input: DraftInput) {
  const { extraction, context, customers, accounts, notices } = input;
  const occurred = occurrence(input);
  const match = matchName(extraction.party, customers);
  if (extraction.party === null) notices.add("missing", "customer");
  else notices.match("customer", match);
  const customer = matchedRecord(match);
  const receivable = customer?.oldestOpenReceivable ?? null;
  // Without receivables:read the directory cannot see balances, so "owes nothing" is unknown.
  if (customer && receivable === null && context.permissions.includes("receivables:read")) {
    notices.add("not_found", "credit");
  }
  const amount = positiveMinorUnits(extraction.amount, context.currencyMinorUnitDigits);
  if (amount === null) notices.add("missing", "amount");
  else if (receivable && amount > BigInt(receivable.balanceMinorUnits)) {
    notices.add("exceeds_total", "amount");
  }
  const account = paymentAccount(accounts, extraction.paymentMethod, notices);
  return {
    kind: "receivable_payment" as const,
    ...occurred,
    customer: { heard: extraction.party, match: recordMatch(match) },
    receivable,
    amountMinorUnits: amount?.toString() ?? null,
    account,
  };
}

async function supplierPaymentDraft<Actor>(
  input: DraftInput,
  directory: SupplierDirectory<Actor>,
  actor: Actor,
  sentence: string,
) {
  const { extraction, context, suppliers, accounts, notices } = input;
  const occurred = occurrence(input);
  const match = matchName(extraction.party, suppliers);
  if (extraction.party === null) notices.add("missing", "supplier");
  else notices.match("supplier", match);
  const supplier = matchedRecord(match);
  const invoice = paymentInvoice(sentence, extraction, input.unread.has("invoice"));
  const canRead = supplier && context.permissions.includes("purchases:read");
  const purchase =
    canRead && invoice.kind !== "unclear"
      ? await directory.findOpenPurchase(
          actor,
          supplier.id,
          invoice.kind === "number" ? invoice.value : null,
        )
      : null;
  if (invoice.kind === "unclear") notices.add("missing", "invoice");
  else if (canRead && purchase === null) {
    notices.add("not_found", invoice.kind === "number" ? "invoice" : "credit");
  }
  const amount = positiveMinorUnits(extraction.amount, context.currencyMinorUnitDigits);
  if (amount === null) notices.add("missing", "amount");
  else if (purchase && amount > BigInt(purchase.balanceMinorUnits)) {
    notices.add("exceeds_total", "amount");
  }
  const account = paymentAccount(accounts, extraction.paymentMethod, notices);
  return {
    kind: "supplier_payment" as const,
    ...occurred,
    supplier: { heard: extraction.party, match: recordMatch(match) },
    purchase,
    amountMinorUnits: amount?.toString() ?? null,
    account,
  };
}

const builders: Record<
  Exclude<AssistantDraftKind, "supplier_payment">,
  (input: DraftInput) => AssistantDraft
> = {
  sale: saleDraft,
  expense: expenseDraft,
  purchase: purchaseDraft,
  receivable_payment: receivablePaymentDraft,
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
    messages: extractionMessages(request.text, request.allowTools),
    jsonSchema: request.allowTools ? toolExtractionJsonSchema : extractionJsonSchema,
    signal: AbortSignal.timeout(dependencies.timeoutMs),
  });
  const read = readExtraction(raw);
  if (!read) {
    throw new AssistantProviderError("invalid_output", "The model output does not fit the schema");
  }
  const { extraction, unread } = read;
  if (extraction.kind === "start_sale" || extraction.kind === "find_product") {
    const result = {
      text: request.text,
      source: request.source,
      spans: [],
      draft: null,
      notices: [],
    };
    if (!request.allowTools) return { ...result, unsupported: "not_a_record" };
    if (extraction.kind === "start_sale") {
      return { ...result, unsupported: null, tool: { name: "start_sale" } };
    }
    const term = extraction.items.length === 1 ? extraction.items[0]?.name : undefined;
    const match = term ? findOccurrences(request.text, term)[0] : undefined;
    const query = match ? request.text.slice(match[0], match[1]).replace(/\s+/gu, " ") : null;
    return { ...result, unsupported: null, tool: { name: "find_product", query } };
  }
  if (
    extraction.kind === "none" ||
    extraction.kind === "several" ||
    (extraction.kind === "purchase" && extraction.settlement === "partial_credit")
  ) {
    return {
      text: request.text,
      source: request.source,
      spans: [],
      draft: null,
      unsupported:
        extraction.kind === "purchase"
          ? "partial_purchase_payment"
          : extraction.kind === "none"
            ? "not_a_record"
            : "several_records",
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
  const input: DraftInput = {
    extraction,
    context: lookup.context,
    products: lookup.products,
    customers: lookup.customers,
    accounts: lookup.accounts,
    suppliers,
    notices,
    unread,
  };
  const draft =
    kind === "supplier_payment"
      ? await supplierPaymentDraft(input, dependencies.suppliers, actor, request.text)
      : builders[kind](input);
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
    notices: notices.capped(),
  });
}
