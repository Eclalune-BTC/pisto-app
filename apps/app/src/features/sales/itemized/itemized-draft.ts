import type {
  AssistantSaleDraft,
  CreateItemizedSaleRequest,
  Product,
  ProductStock,
  SaleFormOptionsResponse,
  SalePaymentMethod,
} from "@pisto/contracts";
import { formatQuantityMinorUnits, parseQuantityToMinorUnits } from "@/features/inventory/quantity";
import { parseAmountToMinorUnits, toDecimalString } from "@/lib/money";

export type PaymentAccount = SaleFormOptionsResponse["data"]["accounts"][number];

/** A product line as typed: the product and stock it was added with, and the texts being edited. */
export type ItemizedLineDraft = {
  product: Product;
  stock: ProductStock | null;
  quantity: string;
  unitPrice: string;
};

export type ItemizedSaleDraft = {
  customer: { id: string; name: string } | null;
  date: string;
  time: string;
  lines: ItemizedLineDraft[];
  note: string;
  received: string;
  /** Until the person types an amount, the amount received follows the total. */
  receivedEdited: boolean;
  method: SalePaymentMethod;
  accountId: string | null;
  dueDate: string;
};

export type LineIssue =
  | "quantity-required"
  | "quantity-invalid"
  | "quantity-decimals"
  | "price-required"
  | "price-invalid"
  | "stock";

export type SaleIssue =
  | "lines-required"
  | "total-zero"
  | "date"
  | "time"
  | "note-too-long"
  | "received-invalid"
  | "received-exceeds"
  | "account-required"
  | "customer-required"
  | "due-date-required"
  | "due-date-invalid"
  | "due-date-before-sale";

export type ItemizedDraftIssues = {
  sale: Partial<
    Record<
      "lines" | "date" | "time" | "note" | "received" | "account" | "customer" | "dueDate",
      SaleIssue
    >
  >;
  lines: Record<string, LineIssue>;
};

export type ItemizedCommand = Omit<CreateItemizedSaleRequest, "idempotencyKey" | "entrySource">;

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function isCalendarDate(value: string): boolean {
  if (!datePattern.test(value) || value.startsWith("0000")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** The product's catalog price as an editable amount, or empty when it has none. */
export function catalogPriceText(product: Product): string {
  return product.sellingPriceMinorUnits === null ||
    product.sellingPriceCurrencyMinorUnitDigits === null
    ? ""
    : toDecimalString(product.sellingPriceMinorUnits, product.sellingPriceCurrencyMinorUnitDigits);
}

/** Quantity times price, rounded half up to a minor unit exactly as the server does. */
export function lineSubtotalMinorUnits(
  quantityMinorUnits: string,
  unitPriceMinorUnits: string,
  quantityPrecision: number,
): string {
  const scale = 10n ** BigInt(quantityPrecision);
  return (
    (2n * BigInt(quantityMinorUnits) * BigInt(unitPriceMinorUnits) + scale) /
    (2n * scale)
  ).toString();
}

type LineAmounts = {
  quantityMinorUnits: string | null;
  unitPriceMinorUnits: string | null;
  subtotalMinorUnits: string | null;
  issue: LineIssue | null;
};

export function lineAmounts(line: ItemizedLineDraft, currencyDigits: number): LineAmounts {
  const precision = line.product.quantityPrecision;
  const quantityText = line.quantity.trim();
  const quantity = quantityText ? parseQuantityToMinorUnits(quantityText, precision) : null;
  const priceText = line.unitPrice.trim();
  const price = priceText
    ? parseAmountToMinorUnits(priceText, currencyDigits, { allowZero: true })
    : null;
  const quantityMinorUnits = quantity && "value" in quantity ? quantity.value : null;
  const unitPriceMinorUnits = price && "value" in price ? price.value : null;
  const issue: LineIssue | null = !quantity
    ? "quantity-required"
    : "error" in quantity
      ? quantity.error === "invalid-decimals"
        ? "quantity-decimals"
        : "quantity-invalid"
      : !price
        ? "price-required"
        : "error" in price
          ? "price-invalid"
          : line.stock && BigInt(quantity.value) > BigInt(line.stock.onHandMinorUnits)
            ? "stock"
            : null;
  return {
    quantityMinorUnits,
    unitPriceMinorUnits,
    subtotalMinorUnits:
      quantityMinorUnits !== null && unitPriceMinorUnits !== null
        ? lineSubtotalMinorUnits(quantityMinorUnits, unitPriceMinorUnits, precision)
        : null,
    issue,
  };
}

export type DraftTotals = {
  /** Null while a line has no computable subtotal. */
  totalMinorUnits: string | null;
  receivedMinorUnits: string | null;
  /** What stays owed; null while the total or the amount received cannot be read. */
  balanceMinorUnits: string | null;
};

export function draftTotals(draft: ItemizedSaleDraft, currencyDigits: number): DraftTotals {
  const subtotals = draft.lines.map((line) => lineAmounts(line, currencyDigits).subtotalMinorUnits);
  const totalMinorUnits =
    subtotals.length > 0 && subtotals.every((value) => value !== null)
      ? subtotals.reduce((sum, value) => sum + BigInt(value as string), 0n).toString()
      : null;
  const received = draft.receivedEdited
    ? draft.received.trim()
      ? parseAmountToMinorUnits(draft.received, currencyDigits, { allowZero: true })
      : { value: "0" }
    : totalMinorUnits === null
      ? null
      : { value: totalMinorUnits };
  const receivedMinorUnits = received && "value" in received ? received.value : null;
  return {
    totalMinorUnits,
    receivedMinorUnits,
    balanceMinorUnits:
      totalMinorUnits !== null &&
      receivedMinorUnits !== null &&
      BigInt(receivedMinorUnits) <= BigInt(totalMinorUnits)
        ? (BigInt(totalMinorUnits) - BigInt(receivedMinorUnits)).toString()
        : null,
  };
}

/** The first account of the kind a payment method usually lands in. */
export function defaultAccountFor(
  method: SalePaymentMethod,
  accounts: readonly PaymentAccount[],
): string | null {
  const kinds: Record<SalePaymentMethod, readonly PaymentAccount["kind"][]> = {
    cash: ["cash"],
    transfer: ["bank", "mobile_money"],
    card: ["bank"],
  };
  return accounts.find((account) => kinds[method].includes(account.kind))?.id ?? null;
}

/**
 * Checks the draft and builds the command the server confirms. Every line carries the price the
 * person saw, so a catalog change made meanwhile cannot change what is charged.
 */
export function validateItemizedDraft(
  draft: ItemizedSaleDraft,
  currencyDigits: number,
): { issues: ItemizedDraftIssues; command: ItemizedCommand | null } {
  const issues: ItemizedDraftIssues = { sale: {}, lines: {} };
  const lines = draft.lines.map((line) => {
    const amounts = lineAmounts(line, currencyDigits);
    if (amounts.issue) issues.lines[line.product.id] = amounts.issue;
    return { line, amounts };
  });
  if (draft.lines.length === 0) issues.sale.lines = "lines-required";
  if (!isCalendarDate(draft.date)) issues.sale.date = "date";
  if (!timePattern.test(draft.time)) issues.sale.time = "time";
  const note = draft.note.trim();
  if (note.length > 240) issues.sale.note = "note-too-long";

  const totals = draftTotals(draft, currencyDigits);
  if (totals.totalMinorUnits === "0") issues.sale.lines = "total-zero";
  if (draft.receivedEdited && totals.receivedMinorUnits === null) {
    issues.sale.received = "received-invalid";
  } else if (
    totals.receivedMinorUnits !== null &&
    totals.totalMinorUnits !== null &&
    BigInt(totals.receivedMinorUnits) > BigInt(totals.totalMinorUnits)
  ) {
    issues.sale.received = "received-exceeds";
  }
  const receivesPayment = totals.receivedMinorUnits !== null && totals.receivedMinorUnits !== "0";
  if (receivesPayment && draft.accountId === null) issues.sale.account = "account-required";
  const owes = totals.balanceMinorUnits !== null && totals.balanceMinorUnits !== "0";
  if (owes) {
    if (draft.customer === null) issues.sale.customer = "customer-required";
    if (!draft.dueDate.trim()) issues.sale.dueDate = "due-date-required";
    else if (!isCalendarDate(draft.dueDate)) issues.sale.dueDate = "due-date-invalid";
    else if (isCalendarDate(draft.date) && draft.dueDate < draft.date) {
      issues.sale.dueDate = "due-date-before-sale";
    }
  }

  const valid =
    Object.keys(issues.sale).length === 0 &&
    Object.keys(issues.lines).length === 0 &&
    totals.totalMinorUnits !== null &&
    totals.receivedMinorUnits !== null;
  if (!valid) return { issues, command: null };
  return {
    issues,
    command: {
      occurredLocalDate: draft.date,
      occurredLocalTime: draft.time,
      ...(note ? { description: note } : {}),
      ...(draft.customer ? { customerId: draft.customer.id } : {}),
      lines: lines.map(({ line, amounts }) => ({
        productId: line.product.id,
        quantityMinorUnits: amounts.quantityMinorUnits as string,
        unitPriceMinorUnits: amounts.unitPriceMinorUnits as string,
      })),
      ...(receivesPayment && draft.accountId
        ? {
            payment: {
              method: draft.method,
              accountId: draft.accountId,
              receivedMinorUnits: totals.receivedMinorUnits as string,
            },
          }
        : {}),
      ...(owes ? { dueDate: draft.dueDate } : {}),
    },
  };
}

/** Adds a product, or one more unit of it when it is already on the sale. */
export function addProductLine(
  lines: readonly ItemizedLineDraft[],
  product: Product,
  stock: ProductStock | null,
): ItemizedLineDraft[] {
  const existing = lines.find((line) => line.product.id === product.id);
  if (!existing) {
    return [...lines, { product, stock, quantity: "1", unitPrice: catalogPriceText(product) }];
  }
  return lines.map((line) =>
    line === existing ? { ...line, quantity: stepQuantity(line, 1) } : line,
  );
}

/** One whole unit more or less; a decrease that would leave nothing keeps the quantity. */
export function stepQuantity(line: ItemizedLineDraft, direction: 1 | -1): string {
  const precision = line.product.quantityPrecision;
  const parsed = parseQuantityToMinorUnits(line.quantity || "0", precision, { allowZero: true });
  const current = "value" in parsed ? BigInt(parsed.value) : 0n;
  const next = current + BigInt(direction) * 10n ** BigInt(precision);
  if (next <= 0n)
    return current > 0n ? formatQuantityMinorUnits(current.toString(), precision) : "1";
  return formatQuantityMinorUnits(next.toString(), precision);
}

export type AssistantPrefill = {
  draft: ItemizedSaleDraft;
  /** What was heard for lines that matched no product; the person adds those by hand. */
  unmatched: string[];
};

/**
 * The form a reviewed assistant draft opens with: every field the draft resolved is filled and the
 * rest stay empty. `products` holds the current catalog record of each matched product.
 */
export function draftFromAssistant(input: {
  accounts: readonly PaymentAccount[];
  assistant: AssistantSaleDraft;
  currencyDigits: number;
  products: ReadonlyMap<string, { product: Product; stock: ProductStock | null }>;
}): AssistantPrefill {
  const { assistant, currencyDigits } = input;
  const lines: ItemizedLineDraft[] = [];
  const unmatched: string[] = [];
  for (const line of assistant.lines) {
    const match = line.product ? input.products.get(line.product.id) : undefined;
    if (!match || lines.some((existing) => existing.product.id === match.product.id)) {
      if (!match) unmatched.push(line.heard);
      continue;
    }
    lines.push({
      product: match.product,
      stock: match.stock,
      quantity:
        line.quantityMinorUnits !== null && line.quantityPrecision !== null
          ? formatQuantityMinorUnits(line.quantityMinorUnits, line.quantityPrecision)
          : "",
      unitPrice:
        line.unitAmountMinorUnits !== null
          ? toDecimalString(line.unitAmountMinorUnits, currencyDigits)
          : catalogPriceText(match.product),
    });
  }
  const method = assistant.paymentMethod ?? "cash";
  const account = assistant.account
    ? input.accounts.find(({ id }) => id === assistant.account?.id)
    : undefined;
  return {
    unmatched,
    draft: {
      customer: assistant.customer.match
        ? { id: assistant.customer.match.id, name: assistant.customer.match.name }
        : null,
      date: assistant.occurredLocalDate,
      time: assistant.occurredLocalTime,
      lines,
      note: assistant.description ?? "",
      received:
        assistant.receivedMinorUnits !== null
          ? toDecimalString(assistant.receivedMinorUnits, currencyDigits)
          : "",
      receivedEdited: assistant.receivedMinorUnits !== null,
      method,
      accountId: account?.id ?? defaultAccountFor(method, input.accounts),
      dueDate: assistant.dueDate ?? "",
    },
  };
}
