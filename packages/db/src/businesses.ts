import type {
  Business,
  BusinessAccess,
  BusinessMember,
  CreateBusinessRequest,
} from "@pisto/contracts";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

import {
  authorizeBusinessAction,
  authorizeSession,
  type DatabaseTransaction,
  type ProductActor,
  requireBusinessPermission,
} from "./business-access.ts";
import type { Database } from "./client.ts";
import { ProductError } from "./errors.ts";
import { getCurrencyMinorUnitDigits, isSupportedTimeZone } from "./local-time.ts";
import { resolveBusinessAccess, rolesWithBusinessPermission } from "./product-access.ts";
import { member, organization, session, user } from "./schema/auth.ts";
import { businessSettings } from "./schema/business.ts";

export interface BusinessRepository {
  listBusinesses(actor: ProductActor): Promise<{
    activeBusinessId: string | null;
    items: Business[];
  }>;
  createBusiness(
    actor: ProductActor,
    command: CreateBusinessRequest,
  ): Promise<{ business: Business; replayed: boolean }>;
  /** The people of the active business; only a role that configures the business may read it. */
  listMembers(actor: ProductActor): Promise<BusinessMember[]>;
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

async function activateBusiness(
  tx: DatabaseTransaction,
  actor: ProductActor,
  businessId: string,
): Promise<void> {
  const activated = await tx
    .update(session)
    .set({ activeOrganizationId: businessId })
    .where(and(eq(session.id, actor.sessionId), eq(session.userId, actor.userId)))
    .returning({ id: session.id });
  if (activated.length !== 1) {
    throw new ProductError("UNAUTHORIZED", "The authenticated session no longer exists");
  }
}

export function createBusinessRepository(db: Database): BusinessRepository {
  return {
    listMembers(actor) {
      return db.transaction(async (tx) => {
        const access = await authorizeBusinessAction(tx, actor, ["business:configure"]);
        return tx
          .select({ email: user.email, id: member.id, name: user.name, role: member.role })
          .from(member)
          .innerJoin(user, eq(user.id, member.userId))
          .where(eq(member.organizationId, access.businessId))
          .orderBy(asc(member.createdAt), asc(member.id));
      });
    },

    listBusinesses(actor) {
      return db.transaction(async (tx) => {
        await authorizeSession(tx, actor, "share");
        const records = await tx
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
        const items = records.map((record) => {
          // The query admits only recognized roles, so an unresolved one is a fault.
          const access = resolveBusinessAccess(record.role);
          if (!access) throw new Error("Business membership role is not recognized");
          return toBusiness({ ...record, access });
        });
        return {
          activeBusinessId: items.some(({ id }) => id === actor.activeBusinessId)
            ? actor.activeBusinessId
            : null,
          items,
        };
      });
    },

    async createBusiness(actor, command) {
      const currencyMinorUnitDigits = getCurrencyMinorUnitDigits(command.currency);
      if (currencyMinorUnitDigits === null) {
        throw new ProductError("VALIDATION_ERROR", "Currency is not a supported ISO 4217 code");
      }
      if (!isSupportedTimeZone(command.timeZone)) {
        throw new ProductError("VALIDATION_ERROR", "Time zone is not a supported IANA identifier");
      }
      return db.transaction(async (tx) => {
        await authorizeSession(tx, actor, "update");
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
          .limit(2)
          .for("update", { of: [member, organization] });

        if (existingMemberships.length > 1) {
          throw new ProductError(
            "CONFLICT",
            "This account already belongs to multiple organizations",
          );
        }
        const existing = existingMemberships[0];

        if (existing) {
          const access = resolveBusinessAccess(existing.role);
          if (!access?.permissions.includes("business:configure")) {
            throw new ProductError(
              "FORBIDDEN",
              "The business membership does not permit configuration",
            );
          }
          if (
            existing.currency === null ||
            existing.currencyMinorUnitDigits === null ||
            existing.timeZone === null
          ) {
            // An organization created outside onboarding is adopted only while its sole
            // member is the actor.
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
            await activateBusiness(tx, actor, existing.businessId);
            return {
              business: toBusiness({
                access,
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
          if (
            existing.name !== command.name ||
            existing.currency !== command.currency ||
            existing.timeZone !== command.timeZone
          ) {
            throw new ProductError("CONFLICT", "This account already belongs to a business");
          }
          await activateBusiness(tx, actor, existing.businessId);
          return {
            business: toBusiness({
              access,
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
        await activateBusiness(tx, actor, businessId);
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
  };
}
