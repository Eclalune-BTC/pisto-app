import type { Entitlement } from "@pisto/contracts";
import { billingWebhookEvent, type Database, entitlement } from "@pisto/db";
import { lte, type SQL } from "drizzle-orm";

export type BillingTransaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type WebhookProvider = Exclude<Entitlement["source"], "manual">;
export type GrantStatus = Entitlement["status"];

export interface WebhookProcessResult {
  duplicate: boolean;
  projected: boolean;
}

export type GrantSubject =
  | { userId: string; organizationId: null }
  | { userId: null; organizationId: string };

/** Provider payloads can contain SDK bigint values that JSONB cannot store. */
export function toJsonRecord(value: object): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  );
}

/**
 * Records the durable receipt that deduplicates a provider event. Returns false
 * for a redelivery, which must not repeat any projection side effect.
 */
export async function recordWebhookEvent(
  tx: BillingTransaction,
  event: {
    provider: WebhookProvider;
    eventKey: string;
    eventType: string;
    payload: object;
    processedAt: Date;
  },
): Promise<boolean> {
  const inserted = await tx
    .insert(billingWebhookEvent)
    .values({ ...event, payload: toJsonRecord(event.payload) })
    .onConflictDoNothing()
    .returning({ id: billingWebhookEvent.id });
  return inserted.length > 0;
}

/**
 * Upserts one provider grant by (source, sourceId, key). An event older than the
 * stored grant's provider time never regresses it.
 */
export async function upsertEntitlementGrant(
  tx: BillingTransaction,
  grant: {
    key: string;
    subject: GrantSubject;
    source: WebhookProvider;
    sourceId: string;
    productId: string;
    status: GrantStatus;
    sourceEventAt: Date;
    validFrom: Date;
    validUntil: Date | null;
    metadata: Record<string, unknown>;
    updatedAt: Date;
  },
  // A provider can keep an existing continuous interval instead of the event's start.
  validFromOnUpdate?: SQL,
): Promise<void> {
  const { key, subject, source, sourceId, updatedAt, ...state } = grant;
  await tx
    .insert(entitlement)
    .values({ key, ...subject, source, sourceId, ...state })
    .onConflictDoUpdate({
      target: [entitlement.source, entitlement.sourceId, entitlement.key],
      set: {
        ...subject,
        ...state,
        ...(validFromOnUpdate ? { validFrom: validFromOnUpdate } : {}),
        updatedAt,
      },
      setWhere: lte(entitlement.sourceEventAt, grant.sourceEventAt),
    });
}
