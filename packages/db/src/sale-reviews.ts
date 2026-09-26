import {
  type CreateSaleRequest,
  createSaleRequestSchema,
  type SaleReview,
  saleReviewSchema,
} from "@pisto/contracts";
import { and, eq, isNull } from "drizzle-orm";

import { authorizeBusinessAction } from "./business-access.ts";
import type { Database } from "./client.ts";
import { lockCommandKey } from "./operation-log.ts";
import { type ProductActor, ProductError, resolveLocalDateTime } from "./product-core.ts";
import { postSale } from "./sales-posting.ts";
import { saleFingerprint } from "./sales-records.ts";
import { saleCorrection, saleOperation, saleReview } from "./schema/sales.ts";

function reviewOwner(actor: ProductActor, businessId: string) {
  return and(eq(saleReview.businessId, businessId), eq(saleReview.actorUserId, actor.userId));
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

export function createSaleReviewRepository(db: Database) {
  return {
    getSaleReview(actor: ProductActor): Promise<SaleReview | null> {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:create"]);
        const [record] = await tx
          .select()
          .from(saleReview)
          .where(and(reviewOwner(actor, access.businessId), isNull(saleReview.closedAt)))
          .limit(1);
        return record ? toSaleReview(record) : null;
      });
    },

    async prepareSaleReview(
      actor: ProductActor,
      rawCommand: CreateSaleRequest,
    ): Promise<SaleReview> {
      const parsed = createSaleRequestSchema.safeParse(rawCommand);
      if (!parsed.success) throw new ProductError("VALIDATION_ERROR", "The sale review is invalid");
      const command = { ...parsed.data, idempotencyKey: parsed.data.idempotencyKey.toLowerCase() };
      const fingerprint = await saleFingerprint(command);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:create"], "update");
        await lockCommandKey(tx, {
          businessId: access.businessId,
          actorUserId: actor.userId,
          idempotencyKey: command.idempotencyKey,
        });
        const [existing] = await tx
          .select()
          .from(saleReview)
          .where(eq(saleReview.id, command.idempotencyKey))
          .limit(1);
        if (existing) {
          if (
            existing.businessId !== access.businessId ||
            existing.actorUserId !== actor.userId ||
            existing.closedAt ||
            !existing.command
          ) {
            throw new ProductError("CONFLICT", "That sale review is no longer available");
          }
          const review = toSaleReview(existing);
          if ((await saleFingerprint(review.command)) !== fingerprint) {
            throw new ProductError(
              "IDEMPOTENCY_CONFLICT",
              "That sale review contains different data",
            );
          }
          return review;
        }
        const [open] = await tx
          .select({ id: saleReview.id })
          .from(saleReview)
          .where(and(reviewOwner(actor, access.businessId), isNull(saleReview.closedAt)))
          .limit(1);
        if (open) throw new ProductError("CONFLICT", "Resolve the existing sale review first");
        for (const table of [saleOperation, saleCorrection]) {
          const [used] = await tx
            .select({ id: table.id })
            .from(table)
            .where(
              and(
                eq(table.businessId, access.businessId),
                eq(table.actorUserId, actor.userId),
                eq(table.idempotencyKey, command.idempotencyKey),
              ),
            )
            .limit(1);
          if (used)
            throw new ProductError(
              "IDEMPOTENCY_CONFLICT",
              "That confirmation key was already used",
            );
        }
        resolveLocalDateTime({
          date: command.occurredLocalDate,
          time: command.occurredLocalTime,
          timeZone: access.timeZone,
        });
        const [record] = await tx
          .insert(saleReview)
          .values({
            id: command.idempotencyKey,
            businessId: access.businessId,
            actorUserId: actor.userId,
            command,
            currency: access.currency,
            currencyMinorUnitDigits: access.currencyMinorUnitDigits,
            timeZone: access.timeZone,
          })
          .returning();
        if (!record) throw new Error("Sale review insert returned no record");
        return toSaleReview(record);
      });
    },

    confirmSaleReview(actor: ProductActor, reviewId: string) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:create"], "update");
        await lockCommandKey(tx, {
          businessId: access.businessId,
          actorUserId: actor.userId,
          idempotencyKey: reviewId,
        });
        const [record] = await tx
          .select()
          .from(saleReview)
          .where(and(reviewOwner(actor, access.businessId), eq(saleReview.id, reviewId)))
          .for("update")
          .limit(1);
        if (!record || record.closedAt)
          throw new ProductError("NOT_FOUND", "Sale review was not found");
        return postSale(tx, actor, toSaleReview(record).command);
      });
    },

    dismissSaleReview(
      actor: ProductActor,
      reviewId: string,
      acknowledgedSaleId: string | null,
    ): Promise<{ saleId: string | null }> {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:create"], "update");
        await lockCommandKey(tx, {
          businessId: access.businessId,
          actorUserId: actor.userId,
          idempotencyKey: reviewId,
        });
        const [record] = await tx
          .select()
          .from(saleReview)
          .where(and(reviewOwner(actor, access.businessId), eq(saleReview.id, reviewId)))
          .for("update")
          .limit(1);
        if (!record) throw new ProductError("NOT_FOUND", "Sale review was not found");
        if (record.saleId && record.saleId !== acknowledgedSaleId) return { saleId: record.saleId };
        if (acknowledgedSaleId && record.saleId !== acknowledgedSaleId) {
          throw new ProductError("CONFLICT", "The acknowledged sale does not match this review");
        }
        if (!record.closedAt) {
          await tx
            .update(saleReview)
            .set({ command: null, closedAt: access.queriedAt })
            .where(eq(saleReview.id, record.id));
        }
        return { saleId: record.saleId };
      });
    },
  };
}
