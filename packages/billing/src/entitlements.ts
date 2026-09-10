import type { BillingScope, Entitlement as EntitlementContract } from "@pisto/contracts";
import { type Database, entitlement } from "@pisto/db";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";

const allowedSources = new Set<EntitlementContract["source"]>(["polar", "revenuecat", "manual"]);

// Unknown sources cannot inherit the reserved manual-override provenance.
export function recognizedSource(value: string): EntitlementContract["source"] | null {
  return allowedSources.has(value as EntitlementContract["source"])
    ? (value as EntitlementContract["source"])
    : null;
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

  return rows.flatMap((row) => {
    const source = recognizedSource(row.source);
    if (!source) return [];
    return [
      {
        key: row.key,
        status: "active" as const,
        source,
        productId: row.productId,
        validFrom: row.validFrom?.toISOString() ?? null,
        validUntil: row.validUntil?.toISOString() ?? null,
        metadata: row.metadata,
      },
    ];
  });
}
