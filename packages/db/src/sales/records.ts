import type {
  CreateSaleRequest,
  ReplaceSaleRequest,
  Sale,
  SaleCorrection,
  SaleReview,
  VoidSaleRequest,
} from "@pisto/contracts";
import {
  entrySourceSchema,
  saleCorrectionKindSchema,
  saleEntryModeSchema,
  saleReviewSchema,
  saleStatusSchema,
} from "@pisto/contracts";
import { and, eq } from "drizzle-orm";

import type { DatabaseTransaction } from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { fingerprintValue, type OperationCommandIdentity } from "../operation-log.ts";
import type { sale, saleCorrection, saleOperation, saleReview } from "../schema/sales.ts";

export type SaleRecord = typeof sale.$inferSelect;
export type SaleCorrectionRecord = typeof saleCorrection.$inferSelect;
export type SaleCorrectionInput =
  | { kind: "void"; command: VoidSaleRequest }
  | { kind: "replacement"; command: ReplaceSaleRequest };

// These canonical shapes are part of every stored sale receipt; changing either
// invalidates replay.
export function saleFingerprint(command: CreateSaleRequest): Promise<string> {
  return fingerprintValue({
    version: 1,
    action: "sale.posted",
    grossMinorUnits: command.grossMinorUnits,
    occurredLocalDate: command.occurredLocalDate,
    occurredLocalTime: command.occurredLocalTime,
    description: command.description ?? null,
  });
}

export function correctionFingerprint(saleId: string, input: SaleCorrectionInput): Promise<string> {
  return fingerprintValue({
    version: 1,
    action: input.kind === "void" ? "sale.voided" : "sale.replaced",
    saleId,
    reason: input.command.reason,
    replacement: input.kind === "replacement" ? input.command.replacement : null,
  });
}

/**
 * Sale posting and correction share one `(business, actor, key)` space across two
 * receipt tables, so each path must refuse a key the other already committed.
 */
export async function requireKeyUnusedBy(
  tx: DatabaseTransaction,
  table: typeof saleOperation | typeof saleCorrection,
  key: Pick<OperationCommandIdentity, "actorUserId" | "businessId" | "idempotencyKey">,
  message: string,
): Promise<void> {
  const [used] = await tx
    .select({ id: table.id })
    .from(table)
    .where(
      and(
        eq(table.businessId, key.businessId),
        eq(table.actorUserId, key.actorUserId),
        eq(table.idempotencyKey, key.idempotencyKey),
      ),
    )
    .limit(1);
  if (used) throw new ProductError("IDEMPOTENCY_CONFLICT", message);
}

export function toCorrection(record: SaleCorrectionRecord): SaleCorrection {
  return {
    id: record.id,
    kind: saleCorrectionKindSchema.parse(record.kind),
    reason: record.reason,
    originalSaleId: record.originalSaleId,
    replacementSaleId: record.replacementSaleId,
    correctedAt: record.createdAt.toISOString(),
  };
}

/**
 * `customerName` is the current name of the customer an itemized sale names; a sale that names one
 * must be read with it.
 */
export function toSale(
  record: SaleRecord,
  correction: SaleCorrection | null = null,
  customerName: string | null = null,
): Sale {
  const entryMode = saleEntryModeSchema.safeParse(record.entryMode);
  if (!entryMode.success) throw new Error("Stored sale entry mode is invalid");
  const entrySource = entrySourceSchema.safeParse(record.entrySource);
  if (!entrySource.success) throw new Error("Stored sale entry source is invalid");
  if (record.customerId !== null && customerName === null) {
    throw new Error("The sale customer was not read with the sale");
  }
  return {
    id: record.id,
    status: saleStatusSchema.parse(record.status),
    entryMode: entryMode.data,
    entrySource: entrySource.data,
    customer:
      record.customerId === null || customerName === null
        ? null
        : { id: record.customerId, name: customerName },
    grossMinorUnits: record.grossMinorUnits.toString(),
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    occurredAt: record.occurredAt.toISOString(),
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    description: record.description,
    correction,
    createdAt: record.createdAt.toISOString(),
  };
}

export function toSaleReview(record: typeof saleReview.$inferSelect): SaleReview {
  return saleReviewSchema.parse({
    id: record.id,
    businessId: record.businessId,
    command: record.command,
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    timeZone: record.timeZone,
    createdAt: record.createdAt.toISOString(),
    saleId: record.saleId,
  });
}
