import type { BillingScope } from "@pisto/contracts";
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
import { and, eq, lte, ne } from "drizzle-orm";
import { z } from "zod";

import type { PolarBillingConfig } from "./config.ts";
import { eventFingerprint } from "./security.ts";

const providerDateSchema = z.union([z.date(), z.iso.datetime({ offset: true })]);
const polarEventSchema = z.looseObject({
  type: z.string().min(1),
  timestamp: providerDateSchema,
  data: z.record(z.string(), z.unknown()),
});
const subscriptionProjectionSchema = z
  .looseObject({
    id: z.string().min(1),
    productId: z.string().min(1),
    customerId: z.string().min(1),
    status: z.enum([
      "incomplete",
      "incomplete_expired",
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "paused",
    ]),
    currentPeriodStart: providerDateSchema,
    currentPeriodEnd: providerDateSchema,
    cancelAtPeriodEnd: z.boolean(),
    metadata: z.looseObject({ referenceId: z.string().min(1).optional() }),
    customer: z.looseObject({
      id: z.string().min(1),
      externalId: z.string().min(1).nullish(),
      email: z.string().min(1).nullish(),
    }),
  })
  .refine(
    (data) => data.customer.id === data.customerId,
    "Subscription customer identifiers disagree",
  )
  .refine(
    (data) => new Date(data.currentPeriodEnd) >= new Date(data.currentPeriodStart),
    "Subscription period is reversed",
  );

export interface WebhookProcessResult {
  duplicate: boolean;
  projected: boolean;
}

export class BillingProviderError extends Error {
  override readonly name = "BillingProviderError";

  constructor() {
    super("The billing provider request failed");
  }
}

export async function readPolarCustomerState(
  client: Pick<Polar, "customers" | "subscriptions"> | null,
  scope: BillingScope,
): Promise<unknown> {
  if (!client) throw new BillingProviderError();
  try {
    // The Better Auth organization-list endpoint prints raw SDK errors directly
    // to console.log. Own scope translation and safe failure at this boundary.
    return scope.type === "organization"
      ? await client.subscriptions.list({ active: true, metadata: { referenceId: scope.id } })
      : await client.customers.getStateExternal({ externalId: scope.id });
  } catch {
    throw new BillingProviderError();
  }
}

function jsonRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)),
  );
}

function polarEntitlementStatus(input: {
  eventType: string;
  providerStatus: string | null;
  validUntil: Date | null;
  now: Date;
}): "active" | "pending" | "revoked" | "expired" | "inactive" {
  // A scheduled cancellation retains provider status `active`; `canceled`
  // already means revoked, even when the old billing period ends in the future.
  if (input.eventType === "subscription.revoked" || input.providerStatus === "canceled") {
    return "revoked";
  }
  if (input.eventType === "subscription.past_due" || input.providerStatus === "past_due") {
    return "pending";
  }
  if (input.eventType === "subscription.paused" || input.providerStatus === "paused") {
    return "inactive";
  }
  if (input.eventType === "subscription.canceled") {
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
    const event = polarEventSchema.parse(payload);
    const eventType = event.type;
    const eventAt = new Date(event.timestamp);
    const subscription = eventType.startsWith("subscription.")
      ? subscriptionProjectionSchema.parse(event.data)
      : null;
    const eventKey = eventFingerprint(payload);
    const storedPayload = jsonRecord(event);

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

      if (!subscription) {
        return { duplicate: false, projected: false };
      }

      const data = subscription;
      const subscriptionId = data.id;
      const productId = data.productId;
      const { customer, metadata } = data;
      const providerCustomerId = data.customerId;
      const externalUserId = customer.externalId;
      const referenceId = metadata.referenceId;
      const providerStatus = data.status;
      const periodStart = new Date(data.currentPeriodStart);
      const periodEnd = new Date(data.currentPeriodEnd);

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
            email: customer.email ?? null,
            metadata,
            syncedAt: eventAt,
          })
          .onConflictDoUpdate({
            target: [billingCustomer.provider, billingCustomer.providerCustomerId],
            set: {
              userId,
              email: customer.email ?? null,
              metadata,
              syncedAt: eventAt,
              updatedAt: new Date(),
            },
            setWhere: lte(billingCustomer.syncedAt, eventAt),
          });
      }

      const status = polarEntitlementStatus({
        eventType,
        providerStatus,
        validUntil: periodEnd,
        now: new Date(),
      });
      const applied = await tx
        .insert(billingSubscription)
        .values({
          provider: "polar",
          providerSubscriptionId: subscriptionId,
          providerCustomerId,
          userId,
          organizationId,
          productId,
          status: providerStatus,
          sourceEventAt: eventAt,
          cancelAtPeriodEnd: data.cancelAtPeriodEnd,
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
            status: providerStatus,
            sourceEventAt: eventAt,
            cancelAtPeriodEnd: data.cancelAtPeriodEnd,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            raw: jsonRecord(data),
            updatedAt: new Date(),
          },
          setWhere: lte(billingSubscription.sourceEventAt, eventAt),
        })
        .returning({ id: billingSubscription.id });
      // The subscription UPSERT serializes this source's event stream, including
      // transitions between keys. A stale event cannot create a previously absent
      // grant merely because that individual key has no newer row yet.
      if (applied.length === 0) return { duplicate: false, projected: false };

      const entitlementKey = entitlementByProduct.get(productId);
      const subject = organizationId
        ? { userId: null, organizationId }
        : userId
          ? { userId, organizationId: null }
          : null;
      // A subscription can change products, including to an unmapped product.
      // Retire grants from its previous mapping before projecting the new key.
      await tx
        .update(entitlement)
        .set({ status: "inactive", sourceEventAt: eventAt, updatedAt: new Date() })
        .where(
          and(
            eq(entitlement.source, "polar"),
            eq(entitlement.sourceId, subscriptionId),
            entitlementKey && subject ? ne(entitlement.key, entitlementKey) : undefined,
          ),
        );
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
          setWhere: lte(entitlement.sourceEventAt, eventAt),
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
