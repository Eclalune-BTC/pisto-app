import type { CreateSaleRequest } from "@pisto/contracts";
import { createSaleRequestSchema } from "@pisto/contracts";
import { and, eq } from "drizzle-orm";
import { authorizeBusinessAction, type DatabaseTransaction } from "./business-access.ts";
import { lockCommandKey } from "./operation-log.ts";
import {
  type ProductActor,
  ProductError,
  requireActiveBusiness,
  resolveLocalDateTime,
} from "./product-core.ts";
import { parseSaleMinorUnits, saleFingerprint, toCorrection, toSale } from "./sales-records.ts";
import { sale, saleCorrection, saleOperation, saleReview } from "./schema/sales.ts";

export async function postSale(
  tx: DatabaseTransaction,
  actor: ProductActor,
  command: CreateSaleRequest,
) {
  const businessId = requireActiveBusiness(actor);
  const grossMinorUnits = parseSaleMinorUnits(command.grossMinorUnits);
  const commandFingerprint = await saleFingerprint(command);

  const access = await authorizeBusinessAction(tx, actor, ["sales:create"], "update");
  await lockCommandKey(tx, {
    actorUserId: actor.userId,
    businessId,
    idempotencyKey: command.idempotencyKey,
  });
  const [existingCorrectionOperation] = await tx
    .select({ id: saleCorrection.id })
    .from(saleCorrection)
    .where(
      and(
        eq(saleCorrection.businessId, businessId),
        eq(saleCorrection.actorUserId, actor.userId),
        eq(saleCorrection.idempotencyKey, command.idempotencyKey),
      ),
    )
    .limit(1);
  if (existingCorrectionOperation) {
    throw new ProductError(
      "IDEMPOTENCY_CONFLICT",
      "That confirmation key was already used for another sale operation",
    );
  }

  const [existingOperation] = await tx
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
        eq(saleOperation.businessId, businessId),
        eq(saleOperation.actorUserId, actor.userId),
        eq(saleOperation.idempotencyKey, command.idempotencyKey),
      ),
    )
    .limit(1);
  if (existingOperation) {
    if (existingOperation.commandFingerprint !== commandFingerprint) {
      throw new ProductError(
        "IDEMPOTENCY_CONFLICT",
        "That confirmation key was already used for a different sale",
      );
    }
    return {
      sale: toSale(
        existingOperation.record,
        existingOperation.correction ? toCorrection(existingOperation.correction) : null,
      ),
      replayed: true,
    };
  }

  const [review] = await tx
    .select()
    .from(saleReview)
    .where(
      and(
        eq(saleReview.id, command.idempotencyKey),
        eq(saleReview.businessId, businessId),
        eq(saleReview.actorUserId, actor.userId),
      ),
    )
    .for("update")
    .limit(1);
  if (review) {
    if (review.closedAt || !review.command) {
      throw new ProductError("CONFLICT", "That sale review was dismissed");
    }
    const stored = createSaleRequestSchema.parse(review.command);
    if ((await saleFingerprint(stored)) !== commandFingerprint) {
      throw new ProductError("IDEMPOTENCY_CONFLICT", "The confirmed sale differs from its review");
    }
    if (
      review.currency !== access.currency ||
      review.currencyMinorUnitDigits !== access.currencyMinorUnitDigits ||
      review.timeZone !== access.timeZone
    ) {
      throw new ProductError("CONFLICT", "Business settings changed; review the sale again");
    }
  }

  const occurredAt = resolveLocalDateTime({
    date: command.occurredLocalDate,
    time: command.occurredLocalTime,
    timeZone: access.timeZone,
  });
  const [createdSale] = await tx
    .insert(sale)
    .values({
      businessId,
      grossMinorUnits,
      currency: access.currency,
      currencyMinorUnitDigits: access.currencyMinorUnitDigits,
      occurredAt,
      occurredLocalDate: command.occurredLocalDate,
      occurredLocalTime: command.occurredLocalTime,
      timeZone: access.timeZone,
      description: command.description ?? null,
      createdByUserId: actor.userId,
    })
    .returning();
  if (!createdSale) throw new Error("Sale insert returned no record");
  await tx.insert(saleOperation).values({
    businessId,
    saleId: createdSale.id,
    actorUserId: actor.userId,
    idempotencyKey: command.idempotencyKey,
    commandFingerprint,
    action: "sale.posted",
  });
  if (review) {
    await tx.update(saleReview).set({ saleId: createdSale.id }).where(eq(saleReview.id, review.id));
  }
  return { sale: toSale(createdSale), replayed: false };
}
