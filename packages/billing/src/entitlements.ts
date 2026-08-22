import type { BillingScope, Entitlement as EntitlementContract } from "@pisto/contracts";
import { type Database, entitlement } from "@pisto/db";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";

const allowedStatuses = new Set<EntitlementContract["status"]>([
  "active",
  "inactive",
  "pending",
  "revoked",
  "expired",
  "unknown",
]);
const allowedSources = new Set<EntitlementContract["source"]>(["polar", "revenuecat", "manual"]);

function normalizeStatus(value: string): EntitlementContract["status"] {
  return allowedStatuses.has(value as EntitlementContract["status"])
    ? (value as EntitlementContract["status"])
    : "unknown";
}

function normalizeSource(value: string): EntitlementContract["source"] {
  return allowedSources.has(value as EntitlementContract["source"])
    ? (value as EntitlementContract["source"])
    : "manual";
}

export async function listEntitlements(
  db: Database,
  scope: BillingScope,
  now = new Date(),
): Promise<EntitlementContract[]> {
  const subject =
    scope.type === "organization"
      ? eq(entitlement.organizationId, scope.id)
      : eq(entitlement.userId, scope.id);
  const rows = await db
    .select()
    .from(entitlement)
    .where(
      and(
        subject,
        eq(entitlement.status, "active"),
        or(isNull(entitlement.validFrom), lte(entitlement.validFrom, now)),
        or(isNull(entitlement.validUntil), gt(entitlement.validUntil, now)),
      ),
    )
    .orderBy(asc(entitlement.key));

  return rows.map((row) => ({
    key: row.key,
    status: normalizeStatus(row.status),
    source: normalizeSource(row.source),
    productId: row.productId,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    metadata: row.metadata,
  }));
}

export function isEntitlementEffective(
  item: {
    status: string;
    validFrom: Date | null;
    validUntil: Date | null;
  },
  now: Date,
): boolean {
  return (
    item.status === "active" &&
    (!item.validFrom || item.validFrom <= now) &&
    (!item.validUntil || item.validUntil > now)
  );
}
