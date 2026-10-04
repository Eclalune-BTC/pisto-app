import type { BillingScope, Entitlement as EntitlementContract } from "@pisto/contracts";
import { type Database, entitlement } from "@pisto/db";
import { and, asc, eq, gt, isNull, lte, or } from "drizzle-orm";

const allowedSources = new Set<EntitlementContract["source"]>(["polar", "revenuecat", "manual"]);

export class EntitlementIntegrityError extends Error {
  override readonly name = "EntitlementIntegrityError";
}

// Only projections in this package write grants. An unknown source is corrupt
// data; it must never be dropped silently or relabeled as a manual override.
export function recognizedSource(value: string): EntitlementContract["source"] {
  if (!allowedSources.has(value as EntitlementContract["source"])) {
    throw new EntitlementIntegrityError("Entitlement grant has an unrecognized source");
  }
  return value as EntitlementContract["source"];
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
    status: "active" as const,
    source: recognizedSource(row.source),
    productId: row.productId,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    metadata: row.metadata,
  }));
}
