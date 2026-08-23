import type {
  Business,
  BusinessAccess,
  CreateBusinessRequest,
  CreateSaleRequest,
  PreviousMonthSummary,
  ReplaceSaleRequest,
  Sale,
  VoidSaleRequest,
} from "@pisto/contracts";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "./client.ts";
import { lockCommandKey } from "./operation-log.ts";
import {
  hasBusinessPermission,
  resolveBusinessAccess,
  rolesWithBusinessPermission,
} from "./product-access.ts";
import {
  getCurrencyMinorUnitDigits,
  isSupportedCurrency,
  isSupportedTimeZone,
  type ProductActor,
  ProductError,
  requireActiveBusiness,
  requireBusinessPermission,
  resolveLocalDateTime,
} from "./product-core.ts";
import { createSalesCorrectionRepository, type SaleCorrectionResult } from "./sales-correction.ts";
import { parseSaleMinorUnits, saleFingerprint, toSale } from "./sales-records.ts";
import { member, organization, session } from "./schema/auth.ts";
import { businessSettings } from "./schema/business.ts";
import { sale, saleCorrection, saleOperation } from "./schema/sales.ts";

export type { ProductActor, ProductErrorCode } from "./product-core.ts";
export {
  getCurrencyMinorUnitDigits,
  isSupportedCurrency,
  isSupportedTimeZone,
  ProductError,
  resolveLocalDateTime,
} from "./product-core.ts";
export type { SaleCorrectionResult } from "./sales-correction.ts";

export interface ProductRepository {
  listBusinesses(actor: ProductActor): Promise<{
    activeBusinessId: string | null;
    items: Business[];
  }>;
  createBusiness(
    actor: ProductActor,
    command: CreateBusinessRequest,
  ): Promise<{ business: Business; replayed: boolean }>;
  createSale(
    actor: ProductActor,
    command: CreateSaleRequest,
  ): Promise<{ sale: Sale; replayed: boolean }>;
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
  getSale(actor: ProductActor, saleId: string): Promise<Sale>;
  getPreviousMonthSummary(actor: ProductActor): Promise<PreviousMonthSummary>;
}

function toBusiness(record: {
  access: BusinessAccess;
  businessId: string;
  createdAt: Date;
  currency: string;
  currencyMinorUnitDigits: number;
  name: string;
  timeZone: string;
}): Business {
  return {
    id: record.businessId,
    name: record.name,
    currency: record.currency,
    currencyMinorUnitDigits: record.currencyMinorUnitDigits,
    timeZone: record.timeZone,
    createdAt: record.createdAt.toISOString(),
    access: record.access,
  };
}

function businessSlug(name: string, id: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base || "business"}-${id.slice(0, 8)}`;
}

export function createProductRepository(db: Database): ProductRepository {
  const corrections = createSalesCorrectionRepository(db);

  return {
    async listBusinesses(actor) {
      const records = await db
        .select({
          businessId: businessSettings.businessId,
          createdAt: businessSettings.createdAt,
          currency: businessSettings.currency,
          currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
          name: organization.name,
          role: member.role,
          timeZone: businessSettings.timeZone,
        })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .innerJoin(businessSettings, eq(businessSettings.businessId, organization.id))
        .where(
          and(
            eq(member.userId, actor.userId),
            inArray(member.role, [...rolesWithBusinessPermission("business:read")]),
          ),
        )
        .orderBy(businessSettings.createdAt);
      const items = records.flatMap((record) => {
        const access = resolveBusinessAccess(record.role);
        return access ? [toBusiness({ ...record, access })] : [];
      });
      return {
        activeBusinessId: items.some(({ id }) => id === actor.activeBusinessId)
          ? actor.activeBusinessId
          : null,
        items,
      };
    },

    async createBusiness(actor, command) {
      if (!isSupportedCurrency(command.currency)) {
        throw new ProductError("VALIDATION_ERROR", "Currency is not a supported ISO 4217 code");
      }
      const currencyMinorUnitDigits = getCurrencyMinorUnitDigits(command.currency);
      if (currencyMinorUnitDigits === null) {
        throw new ProductError("VALIDATION_ERROR", "Currency precision is not supported");
      }
      if (!isSupportedTimeZone(command.timeZone)) {
        throw new ProductError("VALIDATION_ERROR", "Time zone is not a supported IANA identifier");
      }
      return db.transaction(async (tx) => {
        const [databaseTimeZone] = await tx.execute<{ supported: boolean }>(sql`
          select exists(
            select 1 from pg_timezone_names where name = ${command.timeZone}
          ) as supported
        `);
        if (!databaseTimeZone?.supported) {
          throw new ProductError("VALIDATION_ERROR", "Time zone is not supported by the database");
        }
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${actor.userId}, 0))`);
        const existingMemberships = await tx
          .select({
            businessId: organization.id,
            createdAt: organization.createdAt,
            currency: businessSettings.currency,
            currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
            name: organization.name,
            role: member.role,
            timeZone: businessSettings.timeZone,
          })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .leftJoin(businessSettings, eq(businessSettings.businessId, organization.id))
          .where(eq(member.userId, actor.userId))
          .limit(2);

        if (existingMemberships.length > 1) {
          throw new ProductError(
            "CONFLICT",
            "This account already belongs to multiple organizations",
          );
        }
        const existing = existingMemberships[0];

        if (existing) {
          const canConfigure = hasBusinessPermission(existing.role, "business:configure");
          if (
            existing.currency === null ||
            existing.currencyMinorUnitDigits === null ||
            existing.timeZone === null
          ) {
            if (!canConfigure) {
              throw new ProductError(
                "FORBIDDEN",
                "The business membership does not permit configuration",
              );
            }
            const [membershipCount] = await tx
              .select({ value: sql<number>`count(*)::int` })
              .from(member)
              .where(eq(member.organizationId, existing.businessId));
            if (membershipCount?.value !== 1) {
              throw new ProductError(
                "CONFLICT",
                "The existing organization cannot be adopted safely",
              );
            }
            await tx
              .update(organization)
              .set({ name: command.name })
              .where(eq(organization.id, existing.businessId));
            await tx.insert(businessSettings).values({
              businessId: existing.businessId,
              currency: command.currency,
              currencyMinorUnitDigits,
              timeZone: command.timeZone,
            });
            const activated = await tx
              .update(session)
              .set({ activeOrganizationId: existing.businessId })
              .where(and(eq(session.id, actor.sessionId), eq(session.userId, actor.userId)))
              .returning({ id: session.id });
            if (activated.length !== 1) {
              throw new ProductError("UNAUTHORIZED", "The authenticated session no longer exists");
            }
            return {
              business: toBusiness({
                access: requireBusinessPermission(existing.role, "business:configure"),
                businessId: existing.businessId,
                createdAt: existing.createdAt,
                currency: command.currency,
                currencyMinorUnitDigits,
                name: command.name,
                timeZone: command.timeZone,
              }),
              replayed: false,
            };
          }
          if (!canConfigure) {
            throw new ProductError(
              "FORBIDDEN",
              "The business membership does not permit configuration",
            );
          }
          if (
            existing.name === command.name &&
            existing.currency === command.currency &&
            existing.timeZone === command.timeZone
          ) {
            const activated = await tx
              .update(session)
              .set({ activeOrganizationId: existing.businessId })
              .where(and(eq(session.id, actor.sessionId), eq(session.userId, actor.userId)))
              .returning({ id: session.id });
            if (activated.length !== 1) {
              throw new ProductError("UNAUTHORIZED", "The authenticated session no longer exists");
            }
            return {
              business: toBusiness({
                access: requireBusinessPermission(existing.role, "business:configure"),
                businessId: existing.businessId,
                createdAt: existing.createdAt,
                currency: existing.currency,
                currencyMinorUnitDigits: existing.currencyMinorUnitDigits,
                name: existing.name,
                timeZone: existing.timeZone,
              }),
              replayed: true,
            };
          }
          throw new ProductError("CONFLICT", "This account already belongs to a business");
        }

        const businessId = crypto.randomUUID();
        const [createdOrganization] = await tx
          .insert(organization)
          .values({
            id: businessId,
            name: command.name,
            slug: businessSlug(command.name, businessId),
          })
          .returning({ createdAt: organization.createdAt });
        if (!createdOrganization) throw new Error("Organization insert returned no record");
        await tx.insert(businessSettings).values({
          businessId,
          currency: command.currency,
          currencyMinorUnitDigits,
          timeZone: command.timeZone,
        });
        await tx.insert(member).values({
          id: crypto.randomUUID(),
          organizationId: businessId,
          userId: actor.userId,
          role: "owner",
        });
        const updatedSessions = await tx
          .update(session)
          .set({ activeOrganizationId: businessId })
          .where(and(eq(session.id, actor.sessionId), eq(session.userId, actor.userId)))
          .returning({ id: session.id });
        if (updatedSessions.length !== 1) {
          throw new ProductError("UNAUTHORIZED", "The authenticated session no longer exists");
        }
        return {
          business: toBusiness({
            access: requireBusinessPermission("owner", "business:configure"),
            businessId,
            createdAt: createdOrganization.createdAt,
            currency: command.currency,
            currencyMinorUnitDigits,
            name: command.name,
            timeZone: command.timeZone,
          }),
          replayed: false,
        };
      });
    },

    async createSale(actor, command) {
      const businessId = requireActiveBusiness(actor);
      const grossMinorUnits = parseSaleMinorUnits(command.grossMinorUnits);
      const commandFingerprint = await saleFingerprint(command);

      return db.transaction(async (tx) => {
        await lockCommandKey(tx, {
          actorUserId: actor.userId,
          businessId,
          idempotencyKey: command.idempotencyKey,
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
            businessId: businessSettings.businessId,
            currency: businessSettings.currency,
            currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
            name: organization.name,
            role: member.role,
            timeZone: businessSettings.timeZone,
          })
          .from(member)
          .innerJoin(organization, eq(organization.id, member.organizationId))
          .innerJoin(businessSettings, eq(businessSettings.businessId, organization.id))
          .where(and(eq(member.organizationId, businessId), eq(member.userId, actor.userId)))
          .limit(1)
          .for("update");
        if (!access) {
          throw new ProductError("FORBIDDEN", "The active business membership is no longer valid");
        }
        requireBusinessPermission(access.role, "sales:create");

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
          })
          .from(saleOperation)
          .innerJoin(
            sale,
            and(eq(sale.id, saleOperation.saleId), eq(sale.businessId, saleOperation.businessId)),
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
          return { sale: toSale(existingOperation.record), replayed: true };
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
        return { sale: toSale(createdSale), replayed: false };
      });
    },

    voidSale(actor, saleId, command) {
      return corrections.voidSale(actor, saleId, command);
    },

    replaceSale(actor, saleId, command) {
      return corrections.replaceSale(actor, saleId, command);
    },

    async getSale(actor, saleId) {
      const businessId = requireActiveBusiness(actor);
      const [result] = await db
        .select({ record: sale, role: member.role })
        .from(sale)
        .innerJoin(businessSettings, eq(businessSettings.businessId, sale.businessId))
        .innerJoin(
          member,
          and(eq(member.organizationId, sale.businessId), eq(member.userId, actor.userId)),
        )
        .innerJoin(
          session,
          and(
            eq(session.id, actor.sessionId),
            eq(session.userId, actor.userId),
            eq(session.activeOrganizationId, businessId),
            sql`${session.expiresAt} > transaction_timestamp()`,
          ),
        )
        .where(and(eq(sale.businessId, businessId), eq(sale.id, saleId)))
        .limit(1);
      if (!result) throw new ProductError("NOT_FOUND", "Sale was not found");
      requireBusinessPermission(result.role, "sales:read");
      return toSale(result.record, await corrections.findForSale(businessId, saleId));
    },

    async getPreviousMonthSummary(actor) {
      const businessId = requireActiveBusiness(actor);
      type SummaryRow = {
        average_minor_units: string | null;
        currency: string;
        currency_minor_unit_digits: number;
        gross_minor_units: string;
        period_end_local_exclusive: string;
        period_end_utc_exclusive: Date | string;
        period_start_local: string;
        period_start_utc: Date | string;
        queried_at: Date | string;
        sale_count: string;
        time_zone: string;
      };
      const rows = await db.execute<SummaryRow>(sql`
        with authorized as (
          select
            ${businessSettings.businessId} as business_id,
            ${businessSettings.currency} as currency,
            ${businessSettings.currencyMinorUnitDigits} as currency_minor_unit_digits,
            ${businessSettings.timeZone} as time_zone
          from ${businessSettings}
          inner join ${member}
            on ${member.organizationId} = ${businessSettings.businessId}
            and ${member.userId} = ${actor.userId}
            and ${inArray(member.role, [...rolesWithBusinessPermission("sales:summary:read")])}
          inner join ${session}
            on ${session.id} = ${actor.sessionId}
            and ${session.userId} = ${actor.userId}
            and ${session.activeOrganizationId} = ${businessId}
            and ${session.expiresAt} > transaction_timestamp()
          where ${businessSettings.businessId} = ${businessId}
        ), clock as (
          select transaction_timestamp() as queried_at
        ), bounds as (
          select
            queried_at,
            date_trunc('month', queried_at at time zone authorized.time_zone) - interval '1 month' as start_local,
            date_trunc('month', queried_at at time zone authorized.time_zone) as end_local
          from clock, authorized
        ), instants as (
          select
            queried_at,
            start_local,
            end_local,
            start_local at time zone authorized.time_zone as start_utc,
            end_local at time zone authorized.time_zone as end_utc
          from bounds, authorized
        ), totals as (
          select
            coalesce(sum(${sale.grossMinorUnits}), 0::numeric) as gross,
            count(${sale.id})::bigint as sale_count
          from authorized
          cross join instants
          left join ${sale}
            on ${sale.businessId} = authorized.business_id
            and ${sale.status} = 'posted'
            and ${sale.occurredAt} >= instants.start_utc
            and ${sale.occurredAt} < instants.end_utc
        )
        select
          to_char(instants.start_local, 'YYYY-MM-DD') as period_start_local,
          to_char(instants.end_local, 'YYYY-MM-DD') as period_end_local_exclusive,
          instants.start_utc as period_start_utc,
          instants.end_utc as period_end_utc_exclusive,
          instants.queried_at as queried_at,
          authorized.currency as currency,
          authorized.currency_minor_unit_digits as currency_minor_unit_digits,
          authorized.time_zone as time_zone,
          totals.gross::text as gross_minor_units,
          totals.sale_count::text as sale_count,
          case
            when totals.sale_count = 0 then null
            else floor(totals.gross / totals.sale_count + 0.5)::text
          end as average_minor_units
        from authorized, instants, totals
      `);
      const row = rows[0];
      if (!row) {
        throw new ProductError("FORBIDDEN", "The active business access is no longer valid");
      }
      return {
        periodStartLocal: row.period_start_local,
        periodEndLocalExclusive: row.period_end_local_exclusive,
        periodStartUtc: new Date(row.period_start_utc).toISOString(),
        periodEndUtcExclusive: new Date(row.period_end_utc_exclusive).toISOString(),
        timeZone: row.time_zone,
        currency: row.currency,
        currencyMinorUnitDigits: row.currency_minor_unit_digits,
        grossMinorUnits: row.gross_minor_units,
        saleCount: row.sale_count,
        averageMinorUnits: row.average_minor_units,
        queriedAt: new Date(row.queried_at).toISOString(),
      };
    },
  };
}
