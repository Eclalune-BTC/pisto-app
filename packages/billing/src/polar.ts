import {
  billingCustomer,
  billingSubscription,
  billingWebhookEvent,
  type Database,
  entitlement,
  organization,
  user,
} from "@pisto/db";
import { checkout, polar as polarPlugin, portal, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { eq, sql } from "drizzle-orm";

import type { PolarBillingConfig } from "./config.ts";
import { eventFingerprint } from "./security.ts";
import { asRecord, readBoolean, readDate, readString } from "./values.ts";

export interface WebhookProcessResult {
  duplicate: boolean;
  projected: boolean;
}

function jsonRecord(value: unknown): Record<string, unknown> {
  const serialized = JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? item.toString() : item,
  );
  return asRecord(serialized ? JSON.parse(serialized) : null) ?? {};
}

function polarEntitlementStatus(input: {
  eventType: string;
  providerStatus: string | null;
  validUntil: Date | null;
  now: Date;
}): "active" | "pending" | "revoked" | "expired" | "inactive" {
  if (input.eventType === "subscription.revoked") return "revoked";
  if (input.eventType === "subscription.past_due") return "pending";
  if (input.eventType === "subscription.paused") return "inactive";
  if (input.eventType === "subscription.canceled" || input.providerStatus === "canceled") {
    return input.validUntil && input.validUntil > input.now ? "active" : "expired";
  }
  if (
    input.eventType === "subscription.active" ||
    input.eventType === "subscription.uncanceled" ||
    input.eventType === "subscription.resumed" ||
    input.providerStatus === "active" ||
    input.providerStatus === "trialing"
  ) {
    return "active";
  }
  return "pending";
}

export function createPolarWebhookProcessor(input: {
  db: Database;
  config: Extract<PolarBillingConfig, { enabled: true }>;
}) {
  const entitlementByProduct = new Map(
    input.config.products.map((product) => [product.productId, product.entitlementKey]),
  );

  return async (payload: unknown): Promise<WebhookProcessResult> => {
    const event = asRecord(payload);
    const eventType = readString(event, "type") ?? "unknown";
    const eventAt = readDate(event, "timestamp") ?? new Date();
    const eventKey = eventFingerprint(payload);
    const storedPayload = jsonRecord(payload);

    return input.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(billingWebhookEvent)
        .values({
          provider: "polar",
          eventKey,
          eventType,
          payload: storedPayload,
        })
        .onConflictDoNothing()
        .returning({ id: billingWebhookEvent.id });
      if (inserted.length === 0) return { duplicate: true, projected: false };

      if (!eventType.startsWith("subscription.")) {
        return { duplicate: false, projected: false };
      }

      const data = asRecord(event?.data);
      const subscriptionId = readString(data, "id");
      const productId = readString(data, "productId", "product_id");
      if (!data || !subscriptionId || !productId) {
        return { duplicate: false, projected: false };
      }

      const customer = asRecord(data.customer);
      const metadata = asRecord(data.metadata) ?? {};
      const providerCustomerId =
        readString(data, "customerId", "customer_id") ?? readString(customer, "id");
      const externalUserId = readString(customer, "externalId", "external_id");
      const referenceId = readString(metadata, "referenceId", "reference_id");
      const providerStatus = readString(data, "status");
      const periodStart = readDate(
        data,
        "currentPeriodStart",
        "current_period_start",
        "startedAt",
        "started_at",
      );
      const periodEnd = readDate(
        data,
        "currentPeriodEnd",
        "current_period_end",
        "endsAt",
        "ends_at",
        "endedAt",
        "ended_at",
      );

      let userId: string | null = null;
      if (externalUserId) {
        const [existingUser] = await tx
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, externalUserId))
          .limit(1);
        userId = existingUser?.id ?? null;
      }

      let organizationId: string | null = null;
      if (referenceId) {
        const [existingOrganization] = await tx
          .select({ id: organization.id })
          .from(organization)
          .where(eq(organization.id, referenceId))
          .limit(1);
        organizationId = existingOrganization?.id ?? null;
      }

      if (providerCustomerId) {
        await tx
          .insert(billingCustomer)
          .values({
            provider: "polar",
            providerCustomerId,
            userId,
            email: readString(customer, "email"),
            metadata,
            syncedAt: eventAt,
          })
          .onConflictDoUpdate({
            target: [billingCustomer.provider, billingCustomer.providerCustomerId],
            set: {
              userId,
              email: readString(customer, "email"),
              metadata,
              syncedAt: eventAt,
              updatedAt: new Date(),
            },
            setWhere: sql`${billingCustomer.syncedAt} <= ${eventAt}`,
          });
      }

      const status = polarEntitlementStatus({
        eventType,
        providerStatus,
        validUntil: periodEnd,
        now: new Date(),
      });
      await tx
        .insert(billingSubscription)
        .values({
          provider: "polar",
          providerSubscriptionId: subscriptionId,
          providerCustomerId,
          userId,
          organizationId,
          productId,
          status: providerStatus ?? status,
          sourceEventAt: eventAt,
          cancelAtPeriodEnd:
            readBoolean(data, "cancelAtPeriodEnd", "cancel_at_period_end") ?? false,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          raw: jsonRecord(data),
        })
        .onConflictDoUpdate({
          target: [billingSubscription.provider, billingSubscription.providerSubscriptionId],
          set: {
            providerCustomerId,
            userId,
            organizationId,
            productId,
            status: providerStatus ?? status,
            sourceEventAt: eventAt,
            cancelAtPeriodEnd:
              readBoolean(data, "cancelAtPeriodEnd", "cancel_at_period_end") ?? false,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            raw: jsonRecord(data),
            updatedAt: new Date(),
          },
          setWhere: sql`${billingSubscription.sourceEventAt} <= ${eventAt}`,
        });

      const entitlementKey = entitlementByProduct.get(productId);
      const subject = organizationId
        ? { userId: null, organizationId }
        : userId
          ? { userId, organizationId: null }
          : null;
      if (!entitlementKey || !subject) {
        return { duplicate: false, projected: false };
      }

      await tx
        .insert(entitlement)
        .values({
          key: entitlementKey,
          ...subject,
          source: "polar",
          sourceId: subscriptionId,
          productId,
          status,
          sourceEventAt: eventAt,
          validFrom: periodStart,
          validUntil: periodEnd,
          metadata: { eventType, providerStatus },
        })
        .onConflictDoUpdate({
          target: [entitlement.source, entitlement.sourceId, entitlement.key],
          set: {
            ...subject,
            productId,
            status,
            sourceEventAt: eventAt,
            validFrom: periodStart,
            validUntil: periodEnd,
            metadata: { eventType, providerStatus },
            updatedAt: new Date(),
          },
          setWhere: sql`${entitlement.sourceEventAt} <= ${eventAt}`,
        });
      return { duplicate: false, projected: true };
    });
  };
}

export function createPolarIntegration(input: { config: PolarBillingConfig; db: Database }) {
  if (!input.config.enabled) {
    return { client: null, plugin: null, processWebhook: null };
  }

  const client = new Polar({
    accessToken: input.config.accessToken,
    server: input.config.server,
  });
  const processWebhook = createPolarWebhookProcessor({
    db: input.db,
    config: input.config,
  });
  const plugin = polarPlugin({
    client,
    createCustomerOnSignUp: true,
    use: [
      checkout({
        products: input.config.products.map(({ productId, slug }) => ({
          productId,
          slug,
        })),
        successUrl: input.config.successUrl,
        authenticatedUsersOnly: true,
        ...(input.config.returnUrl ? { returnUrl: input.config.returnUrl } : {}),
        ...(input.config.theme ? { theme: input.config.theme } : {}),
      }),
      portal({
        ...(input.config.returnUrl ? { returnUrl: input.config.returnUrl } : {}),
        ...(input.config.theme ? { theme: input.config.theme } : {}),
      }),
      webhooks({
        secret: input.config.webhookSecret,
        onPayload: async (payload) => {
          await processWebhook(payload);
        },
      }),
    ],
  });

  return { client, plugin, processWebhook };
}
