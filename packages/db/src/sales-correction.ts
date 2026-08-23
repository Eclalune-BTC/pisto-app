import type { ReplaceSaleRequest, Sale, SaleCorrection, VoidSaleRequest } from "@pisto/contracts";
import { and, eq, inArray, or, sql } from "drizzle-orm";

import type { Database } from "./client.ts";
import { lockCommandKey } from "./operation-log.ts";
import {
  type ProductActor,
  ProductError,
  requireActiveBusiness,
  requireBusinessPermission,
  resolveLocalDateTime,
} from "./product-core.ts";
import {
  correctionFingerprint,
  parseSaleMinorUnits,
  type SaleCorrectionInput,
  type SaleRecord,
  toCorrection,
  toSale,
} from "./sales-records.ts";
import { member, session } from "./schema/auth.ts";
import { businessSettings } from "./schema/business.ts";
import { sale, saleCorrection, saleOperation } from "./schema/sales.ts";

export interface SaleCorrectionResult {
  correction: SaleCorrection;
  originalSale: Sale;
  replacementSale: Sale | null;
  replayed: boolean;
}

export interface SalesCorrectionRepository {
  voidSale(
    actor: ProductActor,
    saleId: string,
    command: VoidSaleRequest,
  ): Promise<SaleCorrectionResult>;
  replaceSale(
    actor: ProductActor,
    saleId: string,
    command: ReplaceSaleRequest,
  ): Promise<SaleCorrectionResult>;
  findForSale(businessId: string, saleId: string): Promise<SaleCorrection | null>;
}

export function createSalesCorrectionRepository(db: Database): SalesCorrectionRepository {
  async function correctSale(
    actor: ProductActor,
    saleId: string,
    input: SaleCorrectionInput,
  ): Promise<SaleCorrectionResult> {
    const businessId = requireActiveBusiness(actor);
    const reason = input.command.reason.trim();
    if (reason.length < 2 || reason.length > 240) {
      throw new ProductError("VALIDATION_ERROR", "Correction reason must be 2 to 240 characters");
    }
    const replacementMinorUnits =
      input.kind === "replacement"
        ? parseSaleMinorUnits(input.command.replacement.grossMinorUnits)
        : null;
    const commandFingerprint = await correctionFingerprint(saleId, {
      ...input,
      command: { ...input.command, reason },
    } as SaleCorrectionInput);

    return db.transaction(async (tx) => {
      await lockCommandKey(tx, {
        actorUserId: actor.userId,
        businessId,
        idempotencyKey: input.command.idempotencyKey,
      });

      const [activeSession] = await tx
        .select({ id: session.id })
        .from(session)
        .where(
          and(
            eq(session.id, actor.sessionId),
            eq(session.userId, actor.userId),
            eq(session.activeOrganizationId, businessId),
            sql`${session.expiresAt} > transaction_timestamp()`,
          ),
        )
        .limit(1)
        .for("update");
      if (!activeSession) {
        throw new ProductError("UNAUTHORIZED", "The authenticated session is no longer active");
      }

      const [access] = await tx
        .select({
          currency: businessSettings.currency,
          currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
          role: member.role,
          timeZone: businessSettings.timeZone,
        })
        .from(member)
        .innerJoin(businessSettings, eq(businessSettings.businessId, member.organizationId))
        .where(and(eq(member.organizationId, businessId), eq(member.userId, actor.userId)))
        .limit(1)
        .for("update");
      if (!access) {
        throw new ProductError("FORBIDDEN", "The active business membership is no longer valid");
      }
      requireBusinessPermission(access.role, "sales:correct");

      const [existingPostedOperation] = await tx
        .select({ id: saleOperation.id })
        .from(saleOperation)
        .where(
          and(
            eq(saleOperation.businessId, businessId),
            eq(saleOperation.actorUserId, actor.userId),
            eq(saleOperation.idempotencyKey, input.command.idempotencyKey),
          ),
        )
        .limit(1);
      if (existingPostedOperation) {
        throw new ProductError(
          "IDEMPOTENCY_CONFLICT",
          "That confirmation key was already used for another sale operation",
        );
      }

      const [existingCorrection] = await tx
        .select()
        .from(saleCorrection)
        .where(
          and(
            eq(saleCorrection.businessId, businessId),
            eq(saleCorrection.actorUserId, actor.userId),
            eq(saleCorrection.idempotencyKey, input.command.idempotencyKey),
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
        const ids = [
          existingCorrection.originalSaleId,
          existingCorrection.replacementSaleId,
        ].filter((id): id is string => id !== null);
        const records = await tx
          .select()
          .from(sale)
          .where(and(eq(sale.businessId, businessId), inArray(sale.id, ids)));
        const originalRecord = records.find(({ id }) => id === existingCorrection.originalSaleId);
        const replacementRecord = records.find(
          ({ id }) => id === existingCorrection.replacementSaleId,
        );
        if (!originalRecord || (existingCorrection.replacementSaleId && !replacementRecord)) {
          throw new Error("Sale correction references missing canonical records");
        }
        const correction = toCorrection(existingCorrection);
        return {
          correction,
          originalSale: toSale(originalRecord, correction),
          replacementSale: replacementRecord ? toSale(replacementRecord, correction) : null,
          replayed: true,
        };
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
            or(
              eq(saleCorrection.originalSaleId, saleId),
              eq(saleCorrection.replacementSaleId, saleId),
            ),
          ),
        )
        .limit(1);
      if (relatedCorrection) {
        throw new ProductError("CONFLICT", "A corrected sale cannot be corrected again");
      }
      if (originalRecord.status !== "posted") {
        throw new ProductError("CONFLICT", "Only a posted sale can be corrected");
      }

      let replacementRecord: SaleRecord | null = null;
      if (input.kind === "replacement") {
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
            grossMinorUnits: replacementMinorUnits as bigint,
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

      const [createdCorrection] = await tx
        .insert(saleCorrection)
        .values({
          businessId,
          originalSaleId: saleId,
          replacementSaleId: replacementRecord?.id ?? null,
          actorUserId: actor.userId,
          idempotencyKey: input.command.idempotencyKey,
          commandFingerprint,
          kind: input.kind,
          reason,
        })
        .returning();
      if (!createdCorrection) throw new Error("Sale correction insert returned no record");

      const correction = toCorrection(createdCorrection);
      return {
        correction,
        originalSale: toSale(voidedOriginal, correction),
        replacementSale: replacementRecord ? toSale(replacementRecord, correction) : null,
        replayed: false,
      };
    });
  }

  return {
    voidSale: (actor, saleId, command) => correctSale(actor, saleId, { kind: "void", command }),
    replaceSale: (actor, saleId, command) =>
      correctSale(actor, saleId, { kind: "replacement", command }),
    async findForSale(businessId, saleId) {
      const [record] = await db
        .select()
        .from(saleCorrection)
        .where(
          and(
            eq(saleCorrection.businessId, businessId),
            or(
              eq(saleCorrection.originalSaleId, saleId),
              eq(saleCorrection.replacementSaleId, saleId),
            ),
          ),
        )
        .limit(1);
      return record ? toCorrection(record) : null;
    },
  };
}
