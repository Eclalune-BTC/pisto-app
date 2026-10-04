import type { BusinessAccess, BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";

import type { Database } from "./client.ts";
import { ProductError } from "./errors.ts";
import { resolveBusinessAccess } from "./product-access.ts";
import { member, session } from "./schema/auth.ts";
import { businessSettings } from "./schema/business.ts";

export interface ProductActor {
  userId: string;
  sessionId: string;
  activeBusinessId: string | null;
}

export type DatabaseTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type BusinessDatabaseExecutor = Database | DatabaseTransaction;

/**
 * Every business command and locked read holds FOR SHARE on its session and
 * membership rows until it commits. That is the weakest mode which still conflicts
 * with both revocation paths: a role or active-business change is an UPDATE of a
 * non-key column (FOR NO KEY UPDATE) and a removal is a DELETE (FOR UPDATE). FOR KEY
 * SHARE would let a role downgrade commit mid-command. Exclusive modes would
 * serialize every command of one member without protecting any further invariant.
 *
 * "none" exists for a `read only` snapshot transaction: PostgreSQL rejects every row
 * lock there with 25006, so such a read authorizes inside its snapshot instead.
 */
export type BusinessLockStrength = "none" | "share";

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

export function requireBusinessPermission(
  role: string,
  permission: BusinessPermission,
): BusinessAccess {
  const access = resolveBusinessAccess(role);
  if (!access?.permissions.includes(permission)) {
    throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
  }
  return access;
}

export async function authorizeBusinessAction(
  executor: BusinessDatabaseExecutor,
  actor: ProductActor,
  permissions: readonly BusinessPermission[],
  lock: BusinessLockStrength = "share",
): Promise<AuthorizedBusinessContext> {
  const businessId = requireActiveBusiness(actor);
  await authorizeSession(executor, actor, lock, businessId);

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
  for (const permission of permissions) requireBusinessPermission(access.role, permission);
  return access;
}

/**
 * Also protects onboarding and business discovery before an active business exists.
 * Onboarding passes "update" because it rewrites this session row later in the same
 * transaction; upgrading a shared lock there would deadlock two concurrent retries.
 */
export async function authorizeSession(
  executor: BusinessDatabaseExecutor,
  actor: ProductActor,
  lock: BusinessLockStrength | "update",
  expectedBusinessId?: string,
): Promise<void> {
  const sessionQuery = executor
    .select({ id: session.id })
    .from(session)
    .where(
      and(
        eq(session.id, actor.sessionId),
        eq(session.userId, actor.userId),
        expectedBusinessId === undefined
          ? undefined
          : eq(session.activeOrganizationId, expectedBusinessId),
        sql`${session.expiresAt} > transaction_timestamp()`,
      ),
    )
    .limit(1);
  const [activeSession] = lock === "none" ? await sessionQuery : await sessionQuery.for(lock);
  if (!activeSession) {
    throw new ProductError("UNAUTHORIZED", "The authenticated session is no longer active");
  }
}
