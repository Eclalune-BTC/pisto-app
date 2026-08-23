import type { BusinessPermission } from "@pisto/contracts";
import { and, eq, sql } from "drizzle-orm";
import { type ProductActor, ProductError } from "../product.ts";
import { hasBusinessPermission } from "../product-access.ts";
import { member, session } from "../schema/auth.ts";
import { businessSettings } from "../schema/business.ts";
import type { AuthorizedBusiness, DatabaseExecutor } from "./types.ts";

function requireActiveBusiness(actor: ProductActor): string {
  if (!actor.activeBusinessId) {
    throw new ProductError("BUSINESS_REQUIRED", "Select or create a business before continuing");
  }
  return actor.activeBusinessId;
}

export async function authorizeCatalogAction(
  executor: DatabaseExecutor,
  actor: ProductActor,
  permission: BusinessPermission,
  lock: "share" | "update",
): Promise<AuthorizedBusiness> {
  const businessId = requireActiveBusiness(actor);
  const [activeSession] = await executor
    .select({ id: session.id })
    .from(session)
    .where(
      and(
        eq(session.id, actor.sessionId),
        eq(session.userId, actor.userId),
        sql`${session.expiresAt} > transaction_timestamp()`,
      ),
    )
    .limit(1)
    .for(lock);
  if (!activeSession) {
    throw new ProductError("UNAUTHORIZED", "The authenticated session is no longer active");
  }

  const [access] = await executor
    .select({
      businessId: businessSettings.businessId,
      currency: businessSettings.currency,
      currencyMinorUnitDigits: businessSettings.currencyMinorUnitDigits,
      role: member.role,
      timeZone: businessSettings.timeZone,
    })
    .from(businessSettings)
    .innerJoin(
      member,
      and(eq(member.organizationId, businessSettings.businessId), eq(member.userId, actor.userId)),
    )
    .where(eq(businessSettings.businessId, businessId))
    .limit(1)
    .for(lock);
  if (!access || !hasBusinessPermission(access.role, permission)) {
    throw new ProductError("FORBIDDEN", "The business membership does not permit this action");
  }
  return access;
}
