import { billingWebhookEvent, type Database, entitlement, user } from "@pisto/db";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { RevenueCatBillingConfig } from "./config.ts";
import { constantTimeEqual, verifyRevenueCatSignature } from "./security.ts";

const revenueCatEventSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    event_timestamp_ms: z.number().int().nonnegative(),
    app_user_id: z.string().min(1).optional(),
    original_app_user_id: z.string().min(1).optional(),
    aliases: z.array(z.string().min(1)).optional(),
    product_id: z.string().min(1).nullable().optional(),
    entitlement_ids: z.array(z.string().min(1)).nullable().optional(),
    purchased_at_ms: z.number().int().nonnegative().nullable().optional(),
    expiration_at_ms: z.number().int().nonnegative().nullable().optional(),
    transaction_id: z.string().min(1).nullable().optional(),
    original_transaction_id: z.string().min(1).nullable().optional(),
    environment: z.string().optional(),
    store: z.string().optional(),
  })
  .passthrough();

export const revenueCatWebhookSchema = z
  .object({
    api_version: z.string().min(1),
    event: revenueCatEventSchema,
  })
  .passthrough();

export class RevenueCatWebhookError extends Error {
  override readonly name = "RevenueCatWebhookError";

  constructor(
    readonly status: 400 | 401 | 409 | 503,
    readonly code:
      | "REVENUECAT_DISABLED"
      | "REVENUECAT_UNAUTHORIZED"
      | "REVENUECAT_INVALID_PAYLOAD"
      | "REVENUECAT_USER_NOT_FOUND",
    message: string,
  ) {
    super(message);
  }
}

export function revenueCatEventStatus(type: string, expiresAt: Date | null, now: Date) {
  if (type === "EXPIRATION") return "expired" as const;
  if (type === "REFUND") return "revoked" as const;
  if (type === "BILLING_ISSUE") return "pending" as const;
  if (type === "SUBSCRIPTION_PAUSED") return "inactive" as const;
  if (type === "CANCELLATION") {
    return expiresAt && expiresAt > now ? ("active" as const) : ("expired" as const);
  }
  return "active" as const;
}

function dateFromMilliseconds(value: number | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isRevenueCatEventProjectable(type: string): boolean {
  return new Set([
    "INITIAL_PURCHASE",
    "RENEWAL",
    "CANCELLATION",
    "UNCANCELLATION",
    "NON_RENEWING_PURCHASE",
    "SUBSCRIPTION_PAUSED",
    "EXPIRATION",
    "BILLING_ISSUE",
    "REFUND",
    "REFUND_REVERSED",
    "PRODUCT_CHANGE",
    "SUBSCRIPTION_EXTENDED",
    "TEMPORARY_ENTITLEMENT_GRANT",
  ]).has(type);
}

export function createRevenueCatWebhookProcessor(input: {
  db: Database;
  config: RevenueCatBillingConfig;
}) {
  return async (request: {
    authorization: string | null;
    signature: string | null;
    rawBody: string;
    now?: Date;
  }) => {
    const config = input.config;
    if (!config.enabled) {
      throw new RevenueCatWebhookError(
        503,
        "REVENUECAT_DISABLED",
        "RevenueCat webhook processing is disabled",
      );
    }
    if (!request.authorization || !constantTimeEqual(request.authorization, config.authorization)) {
      throw new RevenueCatWebhookError(
        401,
        "REVENUECAT_UNAUTHORIZED",
        "RevenueCat webhook authorization failed",
      );
    }
    if (
      config.signingSecret &&
      (!request.signature ||
        !verifyRevenueCatSignature({
          rawBody: request.rawBody,
          signatureHeader: request.signature,
          secret: config.signingSecret,
          now: request.now,
          toleranceSeconds: config.signatureToleranceSeconds,
        }))
    ) {
      throw new RevenueCatWebhookError(
        401,
        "REVENUECAT_UNAUTHORIZED",
        "RevenueCat webhook signature verification failed",
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(request.rawBody);
    } catch {
      throw new RevenueCatWebhookError(
        400,
        "REVENUECAT_INVALID_PAYLOAD",
        "RevenueCat webhook body must be valid JSON",
      );
    }
    const parsed = revenueCatWebhookSchema.safeParse(body);
    if (!parsed.success) {
      throw new RevenueCatWebhookError(
        400,
        "REVENUECAT_INVALID_PAYLOAD",
        "RevenueCat webhook payload is invalid",
      );
    }

    const { event } = parsed.data;
    const receivedAt = request.now ?? new Date();
    const sourceEventAt = new Date(event.event_timestamp_ms);
    const purchasedAt = dateFromMilliseconds(event.purchased_at_ms);
    const expiresAt = dateFromMilliseconds(event.expiration_at_ms);
    const candidateIds = [
      event.app_user_id,
      event.original_app_user_id,
      ...(event.aliases ?? []),
    ].filter(
      (candidate): candidate is string =>
        typeof candidate === "string" && !candidate.startsWith("$RCAnonymousID:"),
    );

    return input.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(billingWebhookEvent)
        .values({
          provider: "revenuecat",
          eventKey: event.id,
          eventType: event.type,
          payload: parsed.data as unknown as Record<string, unknown>,
          processedAt: receivedAt,
        })
        .onConflictDoNothing()
        .returning({ id: billingWebhookEvent.id });
      if (inserted.length === 0) return { duplicate: true, projected: false };

      if (!isRevenueCatEventProjectable(event.type) || (event.entitlement_ids?.length ?? 0) === 0) {
        return { duplicate: false, projected: false };
      }
      if (candidateIds.length === 0) {
        throw new RevenueCatWebhookError(
          409,
          "REVENUECAT_USER_NOT_FOUND",
          "RevenueCat event does not contain a mapped application user ID",
        );
      }
      const existingUsers = await tx
        .select({ id: user.id })
        .from(user)
        .where(inArray(user.id, [...new Set(candidateIds)]));
      const userId = candidateIds.find((candidate) =>
        existingUsers.some((existing) => existing.id === candidate),
      );
      if (!userId) {
        throw new RevenueCatWebhookError(
          409,
          "REVENUECAT_USER_NOT_FOUND",
          "RevenueCat application user is not registered",
        );
      }

      const mappedEntitlements = (event.entitlement_ids ?? []).flatMap((providerKey) => {
        const key = config.entitlementMap[providerKey];
        return key ? [{ key, providerKey }] : [];
      });
      if (mappedEntitlements.length === 0) {
        return { duplicate: false, projected: false };
      }

      const sourceId =
        event.original_transaction_id ??
        event.transaction_id ??
        `${userId}:${event.product_id ?? "unknown-product"}`;
      const status = revenueCatEventStatus(event.type, expiresAt, receivedAt);
      for (const mapped of mappedEntitlements) {
        await tx
          .insert(entitlement)
          .values({
            key: mapped.key,
            userId,
            organizationId: null,
            source: "revenuecat",
            sourceId,
            productId: event.product_id ?? null,
            status,
            sourceEventAt,
            validFrom: purchasedAt,
            validUntil: expiresAt,
            metadata: {
              providerEntitlementKey: mapped.providerKey,
              eventType: event.type,
              environment: event.environment,
              store: event.store,
              receiptVerified: false,
            },
          })
          .onConflictDoUpdate({
            target: [entitlement.source, entitlement.sourceId, entitlement.key],
            set: {
              userId,
              organizationId: null,
              productId: event.product_id ?? null,
              status,
              sourceEventAt,
              validFrom: purchasedAt,
              validUntil: expiresAt,
              metadata: {
                providerEntitlementKey: mapped.providerKey,
                eventType: event.type,
                environment: event.environment,
                store: event.store,
                receiptVerified: false,
              },
              updatedAt: receivedAt,
            },
            setWhere: sql`${entitlement.sourceEventAt} <= ${sourceEventAt}`,
          });
      }
      return { duplicate: false, projected: true };
    });
  };
}
