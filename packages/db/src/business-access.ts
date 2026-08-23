import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "./client.ts";
import { hasBusinessPermission } from "./product-access.ts";
import { type ProductActor, ProductError } from "./product-core.ts";
import { member, session } from "./schema/auth.ts";
import { businessSettings } from "./schema/business.ts";

export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type BusinessDatabaseExecutor = Database | DatabaseTransaction;
// "none" exists for a `read only` transaction. PostgreSQL rejects every row lock
// there with 25006, so a read-only snapshot cannot authorize with "share".
export type BusinessLockStrength = "none" | "share" | "update";

export interface AuthorizedBusinessContext {
  businessId: string;
  currency: string;
  currencyMinorUnitDigits: number;
  queriedAt: Date;
  role: string;
  timeZone: string;
}

export function requireActiveBusiness(actor: ProductActor): string {
  if (!actor.activeBusinessId) {
    throw new ProductError("BUSINESS_REQUIRED", "Select or create a business before continuing");
  }
  return actor.activeBusinessId;
}

export async function authorizeBusinessAction(
  executor: BusinessDatabaseExecutor,
  actor: ProductActor,
  permissions: readonly BusinessPermission[],
  lock: BusinessLockStrength = "share",
): Promise<AuthorizedBusinessContext> {
  const businessId = requireActiveBusiness(actor);
  const sessionQuery = executor
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
    .limit(1);
  const [activeSession] = lock === "none" ? await sessionQuery : await sessionQuery.for(lock);
  if (!activeSession) {
    throw new ProductError("UNAUTHORIZED", "The authenticated session is no longer active");
  }

  const accessQuery = executor
    .select({
      businessId: businessSettings.businessId,
      currency: businessSettings.currency,
      currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
      queriedAt: sql<Date>`transaction_timestamp()`.mapWith(businessSettings.createdAt),
      role: member.role,
      timeZone: businessSettings.timeZone,
    })
    .from(member)
    .innerJoin(businessSettings, eq(businessSettings.businessId, member.organizationId))
    .where(and(eq(member.organizationId, businessId), eq(member.userId, actor.userId)))
    .limit(1);
  const [access] = lock === "none" ? await accessQuery : await accessQuery.for(lock);
  if (!access) {
    throw new ProductError("FORBIDDEN", "The active business membership is no longer valid");
  }
  if (permissions.some((permission) => !hasBusinessPermission(access.role, permission))) {
    throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
  }
  return access;
}
