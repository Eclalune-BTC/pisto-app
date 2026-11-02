import type {
  CreateItemizedSaleRequest,
  Sale,
  SaleDetails,
  SaleLine,
  SalePaymentMethod,
} from "@pisto/contracts";
import { createItemizedSaleRequestSchema, salePaymentMethodSchema } from "@pisto/contracts";
import { and, asc, eq } from "drizzle-orm";
import type { z } from "zod";

import {
  authorizeBusinessAction,
  type BusinessDatabaseExecutor,
  type DatabaseTransaction,
  type ProductActor,
} from "../business-access.ts";
import { appendSalePaymentCashMovement, lockSalePaymentAccount } from "../cash/sale-ledger.ts";
import { lockSaleProducts, takeSaleStock } from "../catalog/sale-stock.ts";
import { ProductError } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { parseMinorUnits } from "../money.ts";
import { fingerprintValue, lockCommandKey, normalizeIdempotencyKey } from "../operation-log.ts";
import { postSaleReceivable, requireSaleCustomer } from "../receivables/sale-receivable.ts";
import { customer } from "../schema/receivables.ts";
import { saleLine } from "../schema/sale-line.ts";
import { sale, saleCorrection, saleOperation, saleReview } from "../schema/sales.ts";
import { lineSubtotalMinorUnits, saleTotalMinorUnits } from "./line-amounts.ts";
import { requireKeyUnusedBy, type SaleRecord, toCorrection, toSale } from "./records.ts";

type ItemizedSaleCommand = z.output<typeof createItemizedSaleRequestSchema>;

export interface ItemizedSaleResult {
  sale: Sale;
  lines: SaleLine[];
  settlement: SaleDetails["settlement"];
  replayed: boolean;
}

// The canonical shape is part of every stored itemized-sale receipt; changing it invalidates replay.
function itemizedSaleFingerprint(command: ItemizedSaleCommand): Promise<string> {
  return fingerprintValue({
    version: 1,
    action: "sale.itemized_posted",
    occurredLocalDate: command.occurredLocalDate,
    occurredLocalTime: command.occurredLocalTime,
    description: command.description ?? null,
    customerId: command.customerId ?? null,
    lines: command.lines.map((line) => ({
      productId: line.productId,
      quantityMinorUnits: line.quantityMinorUnits,
      unitPriceMinorUnits: line.unitPriceMinorUnits ?? null,
    })),
    payment: command.payment
      ? {
          method: command.payment.method,
          accountId: command.payment.accountId,
          receivedMinorUnits: command.payment.receivedMinorUnits,
        }
      : null,
    dueDate: command.dueDate ?? null,
    entrySource: command.entrySource,
  });
}

/** Identifiers are UUIDs, which PostgreSQL compares case-insensitively; the fingerprint must too. */
function normalizeCommand(command: ItemizedSaleCommand): ItemizedSaleCommand {
  return {
    ...command,
    idempotencyKey: normalizeIdempotencyKey(command.idempotencyKey),
    customerId: command.customerId?.toLowerCase(),
    lines: command.lines.map((line) => ({ ...line, productId: line.productId.toLowerCase() })),
    payment: command.payment
      ? { ...command.payment, accountId: command.payment.accountId.toLowerCase() }
      : undefined,
  };
}

export async function readCustomerName(
  executor: BusinessDatabaseExecutor,
  businessId: string,
  customerId: string | null,
): Promise<string | null> {
  if (customerId === null) return null;
  const [record] = await executor
    .select({ name: customer.name })
    .from(customer)
    .where(and(eq(customer.businessId, businessId), eq(customer.id, customerId)))
    .limit(1);
  if (!record) throw new Error("A sale references a missing customer");
  return record.name;
}

/** The product lines and settlement of an itemized sale, or null for a total-only sale. */
export async function readSaleDetails(
  executor: BusinessDatabaseExecutor,
  record: SaleRecord,
  customerName: string | null,
): Promise<SaleDetails | null> {
  if (record.entryMode !== "itemized") return null;
  const lineRecords = await executor
    .select()
    .from(saleLine)
    .where(and(eq(saleLine.businessId, record.businessId), eq(saleLine.saleId, record.id)))
    .orderBy(asc(saleLine.lineNumber));
  if (lineRecords.length === 0) throw new Error("An itemized sale has no product lines");
  return {
    lines: lineRecords.map((line) => ({
      id: line.id,
      productId: line.productId,
      productName: line.productName,
      quantityMinorUnits: line.quantityMinorUnits.toString(),
      quantityPrecision: line.quantityPrecision,
      unitPriceMinorUnits: line.unitPriceMinorUnits.toString(),
      subtotalMinorUnits: line.subtotalMinorUnits.toString(),
    })),
    settlement: {
      customerId: record.customerId,
      customerName,
      paymentMethod:
        record.paymentMethod === null ? null : salePaymentMethodSchema.parse(record.paymentMethod),
      accountId: record.cashAccountId,
      receivedMinorUnits: record.receivedMinorUnits.toString(),
      creditMinorUnits: record.creditMinorUnits.toString(),
      receivableId: record.receivableId,
      dueDate: record.dueDate,
    },
  };
}

async function readItemizedResult(
  tx: DatabaseTransaction,
  record: SaleRecord,
  correction: typeof saleCorrection.$inferSelect | null,
  replayed: boolean,
): Promise<ItemizedSaleResult> {
  const customerName = await readCustomerName(tx, record.businessId, record.customerId);
  const details = await readSaleDetails(tx, record, customerName);
  if (!details) throw new Error("The replayed sale is not itemized");
  return {
    sale: toSale(record, correction ? toCorrection(correction) : null, customerName),
    ...details,
    replayed,
  };
}

/** Bounded text for the receivable a credit sale opens: the sale note, else what was sold. */
function receivableDescription(description: string | undefined, productNames: string[]): string {
  const text = description ?? productNames.join(", ");
  // Cut on code points so a name never ends in half of a surrogate pair.
  const characters = Array.from(text);
  return characters.length <= 240 ? text : `${characters.slice(0, 239).join("").trimEnd()}…`;
}

/**
 * Posts a counter sale in one transaction: the sale and its lines, stock out for tracked products,
 * the received amount into one account and any balance as a receivable. The server computes every
 * amount from the catalog price unless a line states its own.
 */
export async function postItemizedSale(
  tx: DatabaseTransaction,
  actor: ProductActor,
  rawCommand: CreateItemizedSaleRequest,
): Promise<ItemizedSaleResult> {
  const parsed = createItemizedSaleRequestSchema.safeParse(rawCommand);
  if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "Itemized sale is invalid");
  const command = normalizeCommand(parsed.data);
  const productIds = command.lines.map(({ productId }) => productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new ProductError("VALIDATION_ERROR", "Each product may appear on one line only");
  }
  if (command.dueDate !== undefined && command.dueDate < command.occurredLocalDate) {
    throw new ProductError("VALIDATION_ERROR", "The payment date cannot precede the sale");
  }
  const receivedMinorUnits = command.payment
    ? parseMinorUnits(command.payment.receivedMinorUnits, "The amount received", {
        allowZero: false,
      })
    : 0n;
  const commandFingerprint = await itemizedSaleFingerprint(command);

  const access = await authorizeBusinessAction(tx, actor, ["sales:create"]);
  const key = {
    actorUserId: actor.userId,
    businessId: access.businessId,
    idempotencyKey: normalizeIdempotencyKey(command.idempotencyKey),
  };
  await lockCommandKey(tx, key);
  await requireKeyUnusedBy(
    tx,
    saleCorrection,
    key,
    "That confirmation key was already used for another sale operation",
  );
  const [existing] = await tx
    .select({
      commandFingerprint: saleOperation.commandFingerprint,
      record: sale,
      correction: saleCorrection,
    })
    .from(saleOperation)
    .innerJoin(
      sale,
      and(eq(sale.id, saleOperation.saleId), eq(sale.businessId, saleOperation.businessId)),
    )
    .leftJoin(
      saleCorrection,
      and(
        eq(saleCorrection.businessId, sale.businessId),
        eq(saleCorrection.originalSaleId, sale.id),
      ),
    )
    .where(
      and(
        eq(saleOperation.businessId, key.businessId),
        eq(saleOperation.actorUserId, key.actorUserId),
        eq(saleOperation.idempotencyKey, key.idempotencyKey),
      ),
    )
    .limit(1);
  if (existing) {
    if (existing.commandFingerprint !== commandFingerprint) {
      throw new ProductError(
        "IDEMPOTENCY_CONFLICT",
        "That confirmation key was already used for a different sale",
      );
    }
    return readItemizedResult(tx, existing.record, existing.correction, true);
  }
  // A total-only review reserves its key for the reviewed sale, open or dismissed.
  const [review] = await tx
    .select({ id: saleReview.id })
    .from(saleReview)
    .where(
      and(
        eq(saleReview.id, key.idempotencyKey),
        eq(saleReview.businessId, key.businessId),
        eq(saleReview.actorUserId, key.actorUserId),
      ),
    )
    .limit(1);
  if (review) {
    throw new ProductError(
      "IDEMPOTENCY_CONFLICT",
      "That confirmation key belongs to a total-only sale review",
    );
  }

  const occurredAt = resolveLocalDateTime({
    date: command.occurredLocalDate,
    time: command.occurredLocalTime,
    timeZone: access.timeZone,
  });
  const buyer = command.customerId
    ? await requireSaleCustomer(tx, access.businessId, command.customerId)
    : null;
  const products = await lockSaleProducts(tx, access.businessId, productIds);
  const paymentAccount = command.payment
    ? await lockSalePaymentAccount(tx, access, command.payment.accountId)
    : null;

  const lines = command.lines.map((line, index) => {
    const product = products.get(line.productId);
    if (!product) throw new Error("A locked sale product is missing");
    const unitPriceMinorUnits =
      line.unitPriceMinorUnits === undefined
        ? product.sellingPriceMinorUnits
        : parseMinorUnits(line.unitPriceMinorUnits, "The unit price", { allowZero: true });
    if (unitPriceMinorUnits === null) {
      throw new ProductError(
        "VALIDATION_ERROR",
        "A product without a selling price needs a unit price on the sale",
      );
    }
    const quantityMinorUnits = parseMinorUnits(line.quantityMinorUnits, "The quantity", {
      allowZero: false,
    });
    return {
      lineNumber: index + 1,
      product,
      quantityMinorUnits,
      unitPriceMinorUnits,
      subtotalMinorUnits: lineSubtotalMinorUnits(
        quantityMinorUnits,
        unitPriceMinorUnits,
        product.quantityPrecision,
      ),
    };
  });
  const grossMinorUnits = saleTotalMinorUnits(lines.map((line) => line.subtotalMinorUnits));
  if (grossMinorUnits <= 0n) {
    throw new ProductError("VALIDATION_ERROR", "The sale total must be greater than zero");
  }
  if (receivedMinorUnits > grossMinorUnits) {
    throw new ProductError("VALIDATION_ERROR", "The amount received exceeds the sale total");
  }
  const creditMinorUnits = grossMinorUnits - receivedMinorUnits;
  if (creditMinorUnits > 0n && (!buyer || command.dueDate === undefined)) {
    throw new ProductError(
      "VALIDATION_ERROR",
      "A sale with a balance needs the customer and the agreed payment date",
    );
  }
  if (creditMinorUnits === 0n && command.dueDate !== undefined) {
    throw new ProductError("VALIDATION_ERROR", "A fully paid sale has no payment date");
  }

  const receivableId =
    creditMinorUnits > 0n && buyer && command.dueDate !== undefined
      ? await postSaleReceivable(tx, access, {
          actorUserId: actor.userId,
          customerId: buyer.id,
          description: receivableDescription(
            command.description,
            lines.map(({ product }) => product.name),
          ),
          dueDate: command.dueDate,
          originalMinorUnits: creditMinorUnits,
          postedDate: command.occurredLocalDate,
        })
      : null;
  const paymentMethod: SalePaymentMethod | null = command.payment?.method ?? null;
  const [created] = await tx
    .insert(sale)
    .values({
      businessId: access.businessId,
      entryMode: "itemized",
      entrySource: command.entrySource,
      grossMinorUnits,
      currency: access.currency,
      currencyMinorUnitDigits: access.currencyMinorUnitDigits,
      occurredAt,
      occurredLocalDate: command.occurredLocalDate,
      occurredLocalTime: command.occurredLocalTime,
      timeZone: access.timeZone,
      description: command.description ?? null,
      customerId: buyer?.id ?? null,
      paymentMethod,
      cashAccountId: paymentAccount?.id ?? null,
      receivedMinorUnits,
      creditMinorUnits,
      receivableId,
      dueDate: command.dueDate ?? null,
      createdByUserId: actor.userId,
    })
    .returning();
  if (!created) throw new Error("Itemized sale insert returned no record");

  await tx.insert(saleLine).values(
    lines.map((line) => ({
      businessId: access.businessId,
      saleId: created.id,
      lineNumber: line.lineNumber,
      productId: line.product.id,
      productName: line.product.name,
      quantityMinorUnits: line.quantityMinorUnits,
      quantityPrecision: line.product.quantityPrecision,
      unitPriceMinorUnits: line.unitPriceMinorUnits,
      subtotalMinorUnits: line.subtotalMinorUnits,
    })),
  );
  const occurrence = {
    actorUserId: actor.userId,
    saleId: created.id,
    occurredAt,
    occurredLocalDate: command.occurredLocalDate,
    occurredLocalTime: command.occurredLocalTime,
    timeZone: access.timeZone,
  };
  await takeSaleStock(tx, { ...occurrence, businessId: access.businessId }, lines);
  if (paymentAccount) {
    await appendSalePaymentCashMovement(tx, access, {
      ...occurrence,
      account: paymentAccount,
      amountMinorUnits: receivedMinorUnits,
    });
  }
  await tx.insert(saleOperation).values({
    ...key,
    saleId: created.id,
    commandFingerprint,
    action: "sale.posted",
  });
  return readItemizedResult(tx, created, null, false);
}
