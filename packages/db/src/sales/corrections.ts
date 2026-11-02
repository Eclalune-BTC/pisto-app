import { and, eq, inArray, or } from "drizzle-orm";

import {
  type AuthorizedBusinessContext,
  authorizeBusinessAction,
  type DatabaseTransaction,
  type ProductActor,
} from "../business-access.ts";
import { reverseSalePaymentCashMovement } from "../cash/sale-ledger.ts";
import { returnSaleStock } from "../catalog/sale-stock.ts";
import { ProductError } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { parseMinorUnits } from "../money.ts";
import { lockCommandKey, normalizeIdempotencyKey } from "../operation-log.ts";
import { voidSaleReceivable } from "../receivables/sale-receivable.ts";
import { sale, saleCorrection, saleOperation } from "../schema/sales.ts";
import { readCustomerName } from "./itemized.ts";
import {
  correctionFingerprint,
  requireKeyUnusedBy,
  type SaleCorrectionInput,
  type SaleRecord,
  toCorrection,
  toSale,
} from "./records.ts";
import type { SaleCorrectionResult } from "./types.ts";

async function replayCorrection(
  tx: DatabaseTransaction,
  existing: typeof saleCorrection.$inferSelect,
): Promise<SaleCorrectionResult> {
  const ids = [existing.originalSaleId, existing.replacementSaleId].filter(
    (id): id is string => id !== null,
  );
  const records = await tx
    .select()
    .from(sale)
    .where(and(eq(sale.businessId, existing.businessId), inArray(sale.id, ids)));
  const originalRecord = records.find(({ id }) => id === existing.originalSaleId);
  const replacementRecord = records.find(({ id }) => id === existing.replacementSaleId);
  if (!originalRecord || (existing.replacementSaleId && !replacementRecord)) {
    throw new Error("Sale correction references missing canonical records");
  }
  const correction = toCorrection(existing);
  return {
    correction,
    originalSale: toSale(
      originalRecord,
      correction,
      await readCustomerName(tx, existing.businessId, originalRecord.customerId),
    ),
    replacementSale: replacementRecord ? toSale(replacementRecord, correction) : null,
    replayed: true,
  };
}

export async function correctSale(
  tx: DatabaseTransaction,
  actor: ProductActor,
  saleId: string,
  input: SaleCorrectionInput,
): Promise<SaleCorrectionResult> {
  const reason = input.command.reason.trim();
  if (reason.length < 2 || reason.length > 240) {
    throw new ProductError("VALIDATION_ERROR", "Correction reason must be 2 to 240 characters");
  }
  const replacementMinorUnits =
    input.kind === "replacement"
      ? parseMinorUnits(input.command.replacement.grossMinorUnits, "Sale total", {
          allowZero: false,
        })
      : null;
  const commandFingerprint = await correctionFingerprint(saleId, {
    ...input,
    command: { ...input.command, reason },
  } as SaleCorrectionInput);

  const access = await authorizeBusinessAction(tx, actor, ["sales:correct"]);
  const businessId = access.businessId;
  const key = {
    actorUserId: actor.userId,
    businessId,
    idempotencyKey: normalizeIdempotencyKey(input.command.idempotencyKey),
  };
  await lockCommandKey(tx, key);
  await requireKeyUnusedBy(
    tx,
    saleOperation,
    key,
    "That confirmation key was already used for another sale operation",
  );

  const [existingCorrection] = await tx
    .select()
    .from(saleCorrection)
    .where(
      and(
        eq(saleCorrection.businessId, businessId),
        eq(saleCorrection.actorUserId, key.actorUserId),
        eq(saleCorrection.idempotencyKey, key.idempotencyKey),
      ),
    )
    .limit(1);
  if (existingCorrection) {
    if (existingCorrection.commandFingerprint !== commandFingerprint) {
      throw new ProductError(
        "IDEMPOTENCY_CONFLICT",
        "That confirmation key was already used for a different correction",
      );
    }
    return replayCorrection(tx, existingCorrection);
  }

  const [originalRecord] = await tx
    .select()
    .from(sale)
    .where(and(eq(sale.businessId, businessId), eq(sale.id, saleId)))
    .limit(1)
    .for("update");
  if (!originalRecord) throw new ProductError("NOT_FOUND", "Sale was not found");
  const [relatedCorrection] = await tx
    .select({ id: saleCorrection.id })
    .from(saleCorrection)
    .where(
      and(
        eq(saleCorrection.businessId, businessId),
        or(eq(saleCorrection.originalSaleId, saleId), eq(saleCorrection.replacementSaleId, saleId)),
      ),
    )
    .limit(1);
  if (relatedCorrection) {
    throw new ProductError("CONFLICT", "A corrected sale cannot be corrected again");
  }
  if (originalRecord.status !== "posted") {
    throw new ProductError("CONFLICT", "Only a posted sale can be corrected");
  }
  if (input.kind === "replacement" && originalRecord.entryMode !== "total_only") {
    throw new ProductError("CONFLICT", "An itemized sale can be voided but not replaced");
  }

  let replacementRecord: SaleRecord | null = null;
  if (input.kind === "replacement" && replacementMinorUnits !== null) {
    const replacement = input.command.replacement;
    const occurredAt = resolveLocalDateTime({
      date: replacement.occurredLocalDate,
      time: replacement.occurredLocalTime,
      timeZone: access.timeZone,
    });
    const [createdReplacement] = await tx
      .insert(sale)
      .values({
        businessId,
        grossMinorUnits: replacementMinorUnits,
        currency: access.currency,
        currencyMinorUnitDigits: access.currencyMinorUnitDigits,
        occurredAt,
        occurredLocalDate: replacement.occurredLocalDate,
        occurredLocalTime: replacement.occurredLocalTime,
        timeZone: access.timeZone,
        description: replacement.description ?? null,
        createdByUserId: actor.userId,
      })
      .returning();
    if (!createdReplacement) throw new Error("Replacement sale insert returned no record");
    replacementRecord = createdReplacement;
  }

  const [voidedOriginal] = await tx
    .update(sale)
    .set({ status: "voided" })
    .where(and(eq(sale.businessId, businessId), eq(sale.id, saleId), eq(sale.status, "posted")))
    .returning();
  if (!voidedOriginal) {
    throw new ProductError("CONFLICT", "The sale was corrected by another operation");
  }
  if (voidedOriginal.entryMode === "itemized") {
    await undoItemizedSale(tx, access, actor.userId, voidedOriginal, reason);
  }

  const [createdCorrection] = await tx
    .insert(saleCorrection)
    .values({
      ...key,
      originalSaleId: saleId,
      replacementSaleId: replacementRecord?.id ?? null,
      commandFingerprint,
      kind: input.kind,
      reason,
    })
    .returning();
  if (!createdCorrection) throw new Error("Sale correction insert returned no record");

  const correction = toCorrection(createdCorrection);
  return {
    correction,
    originalSale: toSale(
      voidedOriginal,
      correction,
      await readCustomerName(tx, businessId, voidedOriginal.customerId),
    ),
    replacementSale: replacementRecord ? toSale(replacementRecord, correction) : null,
    replayed: false,
  };
}

/**
 * Voiding an itemized sale undoes each of its effects in the same transaction: the debt is voided,
 * the stock returns and the payment leaves its account. The reversals keep the sale's occurrence,
 * so the period that showed the sale also shows it undone.
 */
async function undoItemizedSale(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  actorUserId: string,
  record: SaleRecord,
  reason: string,
): Promise<void> {
  if (record.receivableId !== null) {
    await voidSaleReceivable(tx, access, {
      actorUserId,
      reason,
      receivableId: record.receivableId,
    });
  }
  const occurrence = {
    actorUserId,
    saleId: record.id,
    occurredAt: record.occurredAt,
    occurredLocalDate: record.occurredLocalDate,
    occurredLocalTime: record.occurredLocalTime,
    timeZone: record.timeZone,
    reason,
  };
  await returnSaleStock(tx, { ...occurrence, businessId: record.businessId });
  if (record.receivedMinorUnits > 0n) {
    await reverseSalePaymentCashMovement(tx, access, occurrence);
  }
}
