import type { BillingScope } from "@pisto/contracts";
import {
  billingCustomer,
  billingSubscription,
  type Database,
  entitlement,
  organization,
  user,
} from "@pisto/db";
import { checkout, polar as polarPlugin, portal, webhooks } from "@polar-sh/better-auth";
import { createPolarCore, type PolarCore } from "@polar-sh/sdk/2026-10";
import { getStateExternalCustomers } from "@polar-sh/sdk/2026-10/services/customers";
import { listSubscriptions } from "@polar-sh/sdk/2026-10/services/subscriptions";
import { and, eq, lte, ne } from "drizzle-orm";
import { z } from "zod";

import type { PolarBillingConfig } from "./config.ts";
import {
  type GrantSubject,
  recordWebhookEvent,
  toJsonRecord,
  upsertEntitlementGrant,
  type WebhookProcessResult,
} from "./projection.ts";
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
    product_id: z.string().min(1),
    customer_id: z.string().min(1),
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
    current_period_start: providerDateSchema,
    current_period_end: providerDateSchema,
    cancel_at_period_end: z.boolean(),
    metadata: z.looseObject({ referenceId: z.string().min(1).optional() }),
    customer: z.looseObject({
      id: z.string().min(1),
      external_id: z.string().min(1).nullish(),
      email: z.string().min(1).nullish(),
    }),
  })
  .refine(
    (data) => data.customer.id === data.customer_id,
    "Subscription customer identifiers disagree",
  )
  .refine(
    (data) => new Date(data.current_period_end) >= new Date(data.current_period_start),
    "Subscription period is reversed",
  );

export class BillingProviderError extends Error {
  override readonly name = "BillingProviderError";

  constructor(options?: ErrorOptions) {
    super("The billing provider request failed", options);
  }
}

// The SDK parses JSON without validating its shape. Required result collections
// must exist even though the provider payload remains opaque to public clients.
const providerRecordSchema = z.looseObject({ id: z.string().min(1) });
const customerStateSchema = providerRecordSchema.extend({
  active_subscriptions: z.array(providerRecordSchema),
  granted_benefits: z.array(providerRecordSchema),
  active_meters: z.array(providerRecordSchema),
});
const subscriptionListSchema = z.looseObject({
  items: z.array(providerRecordSchema),
  pagination: z.looseObject({
    total_count: z.number().int().nonnegative(),
    max_page: z.number().int().nonnegative(),
  }),
});

export async function readPolarCustomerState(
  client: PolarCore | null,
  scope: BillingScope,
): Promise<unknown> {
  if (!client) throw new BillingProviderError();
  try {
    // The Better Auth organization-list endpoint prints raw SDK errors directly
    // to console.log. Own scope translation and safe failure at this boundary.
    if (scope.type === "organization") {
      const result = await listSubscriptions(client)({
        active: true,
        metadata: { referenceId: scope.id },
      });
      return { result: subscriptionListSchema.parse(result) };
    }
    return customerStateSchema.parse(await getStateExternalCustomers(client)(scope.id));
  } catch (cause) {
    throw new BillingProviderError({ cause });
  }
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
  clock?: () => Date;
}) {
  const clock = input.clock ?? (() => new Date());
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
    const now = clock();

    return input.db.transaction(async (tx) => {
      const firstDelivery = await recordWebhookEvent(tx, {
        provider: "polar",
        eventKey,
        eventType,
        payload: event,
        processedAt: now,
      });
      if (!firstDelivery) return { duplicate: true, projected: false };

      if (!subscription) {
        return { duplicate: false, projected: false };
      }

      const data = subscription;
      const subscriptionId = data.id;
      const productId = data.product_id;
      const { customer, metadata } = data;
      const providerCustomerId = data.customer_id;
      const externalUserId = customer.external_id;
      const referenceId = metadata.referenceId;
      const providerStatus = data.status;
      const periodStart = new Date(data.current_period_start);
      const periodEnd = new Date(data.current_period_end);

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
            updatedAt: now,
          },
          setWhere: lte(billingCustomer.syncedAt, eventAt),
        });

      const status = polarEntitlementStatus({
        eventType,
        providerStatus,
        validUntil: periodEnd,
        now,
      });
      const raw = toJsonRecord(data);
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
          cancelAtPeriodEnd: data.cancel_at_period_end,
          currentPeriodStart: periodStart,
          currentPeriodEnd: periodEnd,
          raw,
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
            cancelAtPeriodEnd: data.cancel_at_period_end,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            raw,
            updatedAt: now,
          },
          setWhere: lte(billingSubscription.sourceEventAt, eventAt),
        })
        .returning({ id: billingSubscription.id });
      // The subscription UPSERT serializes this source's event stream, including
      // transitions between keys. A stale event cannot create a previously absent
      // grant merely because that individual key has no newer row yet.
      if (applied.length === 0) return { duplicate: false, projected: false };

      const entitlementKey = entitlementByProduct.get(productId);
      // Polar disables an endpoint after consecutive failed deliveries, so an
      // unlinked subject is recorded without a grant instead of rejected. An
      // organization checkout whose organization is unknown never falls back to
      // a personal grant for the purchaser.
      const subject: GrantSubject | null = referenceId
        ? organizationId
          ? { userId: null, organizationId }
          : null
        : userId
          ? { userId, organizationId: null }
          : null;
      // A subscription can change products, including to an unmapped product.
      // Retire grants from its previous mapping before projecting the new key.
      await tx
        .update(entitlement)
        .set({ status: "inactive", sourceEventAt: eventAt, updatedAt: now })
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

      await upsertEntitlementGrant(tx, {
        key: entitlementKey,
        subject,
        source: "polar",
        sourceId: subscriptionId,
        productId,
        status,
        sourceEventAt: eventAt,
        validFrom: periodStart,
        validUntil: periodEnd,
        metadata: { eventType, providerStatus },
        updatedAt: now,
      });
      return { duplicate: false, projected: true };
    });
  };
}

export function createPolarIntegration(input: { config: PolarBillingConfig; db: Database }) {
  if (!input.config.enabled) {
    return { client: null, plugin: null, processWebhook: null };
  }

  const client = createPolarCore({
    accessToken: input.config.accessToken,
    environment: input.config.server,
    timeout: 10,
  });
  const processWebhook = createPolarWebhookProcessor({
    db: input.db,
    config: input.config,
  });
  const plugin = polarPlugin({
    client,
    // Checkout owns customer creation through the authenticated immutable ID.
    // Account lifecycle hooks must not link an existing buyer by email.
    createCustomerOnSignUp: false,
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
