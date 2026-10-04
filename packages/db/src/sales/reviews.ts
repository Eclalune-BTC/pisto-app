import { createSaleRequestSchema } from "@pisto/contracts";
import { and, eq, isNull } from "drizzle-orm";

import {
  authorizeBusinessAction,
  type DatabaseTransaction,
  type ProductActor,
} from "../business-access.ts";
import type { Database } from "../client.ts";
import { ProductError, parseInput } from "../errors.ts";
import { resolveLocalDateTime } from "../local-time.ts";
import { lockCommandKey, lockSemanticKey, normalizeIdempotencyKey } from "../operation-log.ts";
import { saleCorrection, saleOperation, saleReview } from "../schema/sales.ts";
import { postAuthorizedSale } from "./posting.ts";
import { requireKeyUnusedBy, saleFingerprint, toSaleReview } from "./records.ts";
import type { SalesRepository } from "./types.ts";

type ReviewCommands = Pick<
  SalesRepository,
  "confirmSaleReview" | "dismissSaleReview" | "getSaleReview" | "prepareSaleReview"
>;

function reviewOwner(actor: ProductActor, businessId: string) {
  return and(eq(saleReview.businessId, businessId), eq(saleReview.actorUserId, actor.userId));
}

async function lockOwnReview(tx: DatabaseTransaction, actor: ProductActor, rawReviewId: string) {
  const access = await authorizeBusinessAction(tx, actor, ["sales:create"]);
  const reviewId = normalizeIdempotencyKey(rawReviewId);
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
  return { access, record };
}

export function createReviewCommands(db: Database): ReviewCommands {
  return {
    getSaleReview(actor) {
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

    async prepareSaleReview(actor, rawCommand) {
      const parsed = parseInput(createSaleRequestSchema, rawCommand, "The sale review is invalid");
      // The stored review id must equal the command key, and PostgreSQL stores a UUID
      // in lower case, so the snapshot keeps the normalized spelling.
      const command = { ...parsed, idempotencyKey: normalizeIdempotencyKey(parsed.idempotencyKey) };
      const fingerprint = await saleFingerprint(command);
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["sales:create"]);
        const key = {
          businessId: access.businessId,
          actorUserId: actor.userId,
          idempotencyKey: command.idempotencyKey,
        };
        await lockCommandKey(tx, key);
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
        // One open review per actor: serialize preparations with different keys so the
        // check below sees a concurrent commit instead of failing on the unique index.
        await lockSemanticKey(tx, "sale-review-open", access.businessId, actor.userId);
        const [open] = await tx
          .select({ id: saleReview.id })
          .from(saleReview)
          .where(and(reviewOwner(actor, access.businessId), isNull(saleReview.closedAt)))
          .limit(1);
        if (open) throw new ProductError("CONFLICT", "Resolve the existing sale review first");
        for (const table of [saleOperation, saleCorrection]) {
          await requireKeyUnusedBy(tx, table, key, "That confirmation key was already used");
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

    confirmSaleReview(actor, reviewId) {
      return db.transaction(async (tx) => {
        const { access, record } = await lockOwnReview(tx, actor, reviewId);
        if (!record || record.closedAt) {
          throw new ProductError("NOT_FOUND", "Sale review was not found");
        }
        return postAuthorizedSale(tx, access, actor, toSaleReview(record).command);
      });
    },

    dismissSaleReview(actor, reviewId, acknowledgedSaleId) {
      return db.transaction(async (tx) => {
        const { access, record } = await lockOwnReview(tx, actor, reviewId);
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
