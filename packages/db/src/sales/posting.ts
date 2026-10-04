import { type CreateSaleRequest, createSaleRequestSchema, type Sale } from "@pisto/contracts";
import { and, eq } from "drizzle-orm";

import {
  type AuthorizedBusinessContext,
  authorizeBusinessAction,
  type DatabaseTransaction,
  type ProductActor,
} from "../business-access.ts";
import { ProductError } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { parseMinorUnits } from "../money.ts";
import { lockCommandKey, normalizeIdempotencyKey } from "../operation-log.ts";
import { sale, saleCorrection, saleOperation, saleReview } from "../schema/sales.ts";
import { requireKeyUnusedBy, saleFingerprint, toCorrection, toSale } from "./records.ts";

export type PostedSale = { sale: Sale; replayed: boolean };

export async function postSale(
  tx: DatabaseTransaction,
  actor: ProductActor,
  command: CreateSaleRequest,
): Promise<PostedSale> {
  const access = await authorizeBusinessAction(tx, actor, ["sales:create"]);
  return postAuthorizedSale(tx, access, actor, command);
}

/** A key that a review reserved must carry exactly the reviewed sale. */
export async function postAuthorizedSale(
  tx: DatabaseTransaction,
  access: AuthorizedBusinessContext,
  actor: ProductActor,
  rawCommand: CreateSaleRequest,
): Promise<PostedSale> {
  const command = {
    ...rawCommand,
    idempotencyKey: normalizeIdempotencyKey(rawCommand.idempotencyKey),
  };
  const grossMinorUnits = parseMinorUnits(command.grossMinorUnits, "Sale total", {
    allowZero: false,
  });
  const commandFingerprint = await saleFingerprint(command);
  const key = {
    actorUserId: actor.userId,
    businessId: access.businessId,
    idempotencyKey: command.idempotencyKey,
  };
  await lockCommandKey(tx, key);
  await requireKeyUnusedBy(
    tx,
    saleCorrection,
    key,
    "That confirmation key was already used for another sale operation",
  );

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
        eq(saleOperation.businessId, key.businessId),
        eq(saleOperation.actorUserId, key.actorUserId),
        eq(saleOperation.idempotencyKey, key.idempotencyKey),
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
        eq(saleReview.businessId, key.businessId),
        eq(saleReview.actorUserId, key.actorUserId),
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
      businessId: key.businessId,
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
    ...key,
    saleId: createdSale.id,
    commandFingerprint,
    action: "sale.posted",
  });
  if (review) {
    await tx.update(saleReview).set({ saleId: createdSale.id }).where(eq(saleReview.id, review.id));
  }
  return { sale: toSale(createdSale), replayed: false };
}
