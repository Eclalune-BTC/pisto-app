import { afterAll, describe, expect, test } from "bun:test";
import {
  billingSubscription,
  billingWebhookEvent,
  createDatabase,
  type Database,
  entitlement,
  organization,
  parseDatabaseConfig,
  user,
} from "@pisto/db";
import { eq } from "drizzle-orm";

import { listEntitlements } from "../src/entitlements.ts";
import { createPolarWebhookProcessor } from "../src/polar.ts";
import { createRevenueCatWebhookProcessor } from "../src/revenuecat.ts";

const config = parseDatabaseConfig(process.env);
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(config.url).hostname)) {
  throw new Error("Billing integration tests require local PostgreSQL");
}
const database = createDatabase({ ...config, maxConnections: 2 });
afterAll(() => database.close());

// Every case rolls back its entire fixture and all nested webhook transactions.
async function withFixture(run: (db: Database, userId: string) => Promise<void>) {
  const rollback = new Error("Rollback integration fixture");
  try {
    await database.db.transaction(async (tx) => {
      const userId = `billing-integration-${crypto.randomUUID()}`;
      await tx
        .insert(user)
        .values({ id: userId, name: "Billing Test", email: `${userId}@example.test` });
      await run(tx as unknown as Database, userId);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

describe("PostgreSQL entitlement resolution", () => {
  const now = new Date("2026-09-10T12:00:00.000Z");
  const before = new Date(now.getTime() - 1);
  const after = new Date(now.getTime() + 1);

  test("includes the start boundary, excludes the expiry boundary, and supports open intervals", () =>
    withFixture(async (db, userId) => {
      await db.insert(entitlement).values(
        [
          { key: "unbounded", validFrom: null, validUntil: null },
          { key: "inside", validFrom: before, validUntil: after },
          { key: "starts-now", validFrom: now, validUntil: after },
          { key: "expires-now", validFrom: before, validUntil: now },
          { key: "expired", validFrom: null, validUntil: before },
          { key: "future", validFrom: after, validUntil: null },
        ].map((grant) => ({
          ...grant,
          userId,
          source: "polar",
          sourceId: crypto.randomUUID(),
          status: "active",
          sourceEventAt: now,
        })),
      );

      const grants = await listEntitlements(db, { type: "user", id: userId }, now);
      expect(grants.map((grant) => grant.key)).toEqual(["inside", "starts-now", "unbounded"]);
      expect(grants.find((grant) => grant.key === "starts-now")).toMatchObject({
        validFrom: now.toISOString(),
        validUntil: after.toISOString(),
      });
      expect(grants.find((grant) => grant.key === "unbounded")).toMatchObject({
        validFrom: null,
        validUntil: null,
      });
    }));

  test("rejects every non-active stored status even without an expiry", () =>
    withFixture(async (db, userId) => {
      await db.insert(entitlement).values(
        ["active", "inactive", "pending", "revoked", "expired", "unknown", "unexpected"].map(
          (status) => ({
            key: status,
            userId,
            source: "polar",
            sourceId: crypto.randomUUID(),
            status,
            sourceEventAt: now,
          }),
        ),
      );

      const grants = await listEntitlements(db, { type: "user", id: userId }, now);
      expect(grants.map((grant) => grant.key)).toEqual(["active"]);
    }));

  test("isolates users and organizations even when their identifiers match", () =>
    withFixture(async (db, userId) => {
      const otherUserId = `billing-integration-${crypto.randomUUID()}`;
      const otherOrganizationId = crypto.randomUUID();
      await db.insert(user).values({
        id: otherUserId,
        name: "Other Billing Test",
        email: `${otherUserId}@example.test`,
      });
      await db.insert(organization).values(
        [userId, otherOrganizationId].map((id) => ({
          id,
          name: "Billing Test Organization",
          slug: `billing-integration-${id}`,
        })),
      );
      await db.insert(entitlement).values(
        [
          { key: "user", userId, organizationId: null },
          { key: "other-user", userId: otherUserId, organizationId: null },
          { key: "organization", userId: null, organizationId: userId },
          { key: "other-organization", userId: null, organizationId: otherOrganizationId },
        ].map((grant) => ({
          ...grant,
          source: "polar",
          sourceId: crypto.randomUUID(),
          status: "active",
          sourceEventAt: now,
        })),
      );

      const userGrants = await listEntitlements(db, { type: "user", id: userId }, now);
      const organizationGrants = await listEntitlements(
        db,
        { type: "organization", id: userId },
        now,
      );
      expect(userGrants.map((grant) => grant.key)).toEqual(["user"]);
      expect(organizationGrants.map((grant) => grant.key)).toEqual(["organization"]);
    }));

  test("retains recognized independent grants and drops unrecognized provenance", () =>
    withFixture(async (db, userId) => {
      await db.insert(entitlement).values(
        ["polar", "revenuecat", "manual", "stripe", "", "POLAR"].map((source) => ({
          key: "pro",
          userId,
          source,
          sourceId: crypto.randomUUID(),
          status: "active",
          sourceEventAt: now,
        })),
      );

      const grants = await listEntitlements(db, { type: "user", id: userId }, now);
      expect(grants.map((grant) => grant.source).sort()).toEqual(["manual", "polar", "revenuecat"]);
      expect(grants.every((grant) => grant.key === "pro" && grant.status === "active")).toBe(true);
    }));
});

function polarFixture(db: Database, userId: string) {
  const subscriptionId = crypto.randomUUID();
  const customerId = crypto.randomUUID();
  const premiumId = crypto.randomUUID();
  const basicId = crypto.randomUUID();
  const project = createPolarWebhookProcessor({
    db,
    config: {
      enabled: true,
      accessToken: "unused",
      webhookSecret: "unused",
      server: "sandbox",
      successUrl: "http://localhost/",
      products: [
        { productId: premiumId, slug: "premium", entitlementKey: "premium" },
        { productId: basicId, slug: "basic", entitlementKey: "basic" },
      ],
    },
  });
  const event = (type: string, timestamp: string, productId = premiumId) => ({
    type,
    timestamp,
    data: {
      id: subscriptionId,
      productId,
      customerId,
      status: type === "subscription.revoked" ? "canceled" : "active",
      customer: { id: customerId, externalId: userId, email: `${userId}@example.test` },
      currentPeriodStart: "2026-09-01T00:00:00Z",
      currentPeriodEnd: "2099-10-01T00:00:00Z",
    },
  });
  return { project, event, subscriptionId, premiumId, basicId };
}

describe("Polar PostgreSQL webhook projection", () => {
  test("distinguishes scheduled cancellation from revoked provider state in every event", () =>
    withFixture(async (db, userId) => {
      const { project, event } = polarFixture(db, userId);
      await project(event("subscription.canceled", "2026-09-01T00:00:00Z"));
      const rows = () => db.select().from(entitlement).where(eq(entitlement.userId, userId));
      expect((await rows())[0]?.status).toBe("active");
      for (const [index, type] of ["subscription.updated", "subscription.canceled"].entries()) {
        const payload = event(type, `2026-09-0${index + 2}T00:00:00Z`);
        payload.data.status = "canceled";
        await project(payload);
        expect((await rows())[0]?.status).toBe("revoked");
      }
    }));
  test("persists a lifecycle event and deduplicates it using real timestamp encoders", () =>
    withFixture(async (db, userId) => {
      const { project, event } = polarFixture(db, userId);
      const payload = event("subscription.active", "2026-09-01T00:00:00Z");
      expect(await project(payload)).toEqual({ duplicate: false, projected: true });
      expect(await project(payload)).toEqual({ duplicate: true, projected: false });
      const grants = await db.select().from(entitlement).where(eq(entitlement.userId, userId));
      expect(grants).toHaveLength(1);
      expect(grants[0]?.status).toBe("active");
    }));

  test("retires the previous key when a subscription changes product, then revokes the current key", () =>
    withFixture(async (db, userId) => {
      const { project, event, basicId } = polarFixture(db, userId);
      await project(event("subscription.active", "2026-09-01T00:00:00Z"));
      await project(event("subscription.updated", "2026-09-02T00:00:00Z", basicId));
      await project(event("subscription.revoked", "2026-09-03T00:00:00Z", basicId));
      const grants = await db.select().from(entitlement).where(eq(entitlement.userId, userId));
      expect(grants.find((grant) => grant.key === "premium")?.status).toBe("inactive");
      expect(grants.find((grant) => grant.key === "basic")?.status).toBe("revoked");
    }));

  test("does not resurrect an absent old key from a late earlier-product event", () =>
    withFixture(async (db, userId) => {
      const { project, event, basicId, subscriptionId } = polarFixture(db, userId);
      await project(event("subscription.revoked", "2026-09-03T00:00:00Z", basicId));
      expect(await project(event("subscription.active", "2026-09-01T00:00:00Z"))).toEqual({
        duplicate: false,
        projected: false,
      });
      const grants = await db.select().from(entitlement).where(eq(entitlement.userId, userId));
      expect(grants.map((grant) => grant.key)).toEqual(["basic"]);
      const [subscription] = await db
        .select()
        .from(billingSubscription)
        .where(eq(billingSubscription.providerSubscriptionId, subscriptionId));
      expect(subscription?.productId).toBe(basicId);
      expect(subscription?.status).toBe("canceled");
    }));

  test("retires mapped access when a subscription switches to an unmapped product", () =>
    withFixture(async (db, userId) => {
      const { project, event } = polarFixture(db, userId);
      await project(event("subscription.active", "2026-09-01T00:00:00Z"));
      expect(
        await project(event("subscription.updated", "2026-09-02T00:00:00Z", crypto.randomUUID())),
      ).toEqual({ duplicate: false, projected: false });
      const grants = await db.select().from(entitlement).where(eq(entitlement.userId, userId));
      expect(grants[0]?.status).toBe("inactive");
    }));
});

describe("RevenueCat PostgreSQL webhook projection", () => {
  test("keeps grace for either ordering of billing-issue and its cancellation companion", () =>
    withFixture(async (db, userId) => {
      const project = createRevenueCatWebhookProcessor({
        db,
        config: {
          enabled: true,
          authorization: "test-webhook-authorization",
          signatureToleranceSeconds: 300,
          allowedEnvironment: "PRODUCTION",
          entitlementMap: { pro: "pro" },
        },
      });
      const now = new Date("2026-09-10T00:00:00Z");
      for (const order of [
        ["BILLING_ISSUE", "CANCELLATION"],
        ["CANCELLATION", "BILLING_ISSUE"],
      ]) {
        const sourceId = crypto.randomUUID();
        const send = (type: string) =>
          project({
            authorization: "test-webhook-authorization",
            signature: null,
            now,
            rawBody: JSON.stringify({
              api_version: "1.0",
              event: {
                id: crypto.randomUUID(),
                type,
                event_timestamp_ms:
                  now.getTime() + (type === "BILLING_ISSUE" ? 0 : type === "CANCELLATION" ? 1 : 2),
                app_user_id: userId,
                entitlement_ids: ["pro"],
                environment: "PRODUCTION",
                product_id: "monthly",
                original_transaction_id: sourceId,
                purchased_at_ms: Date.parse("2026-09-01T00:00:00Z"),
                expiration_at_ms: now.getTime() - 1,
                ...(type === "BILLING_ISSUE"
                  ? { grace_period_expiration_at_ms: Date.parse("2026-09-13T00:00:00Z") }
                  : {}),
                ...(type === "CANCELLATION" ? { cancel_reason: "BILLING_ERROR" } : {}),
              },
            }),
          });
        for (const type of order) await send(type);
        const rows = () => db.select().from(entitlement).where(eq(entitlement.sourceId, sourceId));
        expect((await rows())[0]?.status).toBe("active");
        expect((await rows())[0]?.validUntil?.toISOString()).toBe("2026-09-13T00:00:00.000Z");
        await send("EXPIRATION");
        expect((await rows())[0]?.status).toBe("expired");
      }
    }));
  test("keeps a continuous paid interval when Apple reports tomorrow's renewal today", () =>
    withFixture(async (db, userId) => {
      const project = createRevenueCatWebhookProcessor({
        db,
        config: {
          enabled: true,
          authorization: "test-webhook-authorization",
          signatureToleranceSeconds: 300,
          allowedEnvironment: "PRODUCTION",
          entitlementMap: { pro: "pro" },
        },
      });
      const transactionId = crypto.randomUUID();
      const now = new Date("2026-09-30T12:00:00Z");
      const send = (type: string, start: string, end: string, timestamp: number) =>
        project({
          authorization: "test-webhook-authorization",
          signature: null,
          now,
          rawBody: JSON.stringify({
            api_version: "1.0",
            event: {
              id: crypto.randomUUID(),
              type,
              event_timestamp_ms: timestamp,
              app_user_id: userId,
              entitlement_ids: ["pro"],
              environment: "PRODUCTION",
              product_id: "monthly",
              original_transaction_id: transactionId,
              purchased_at_ms: Date.parse(start),
              expiration_at_ms: Date.parse(end),
            },
          }),
        });
      await send(
        "INITIAL_PURCHASE",
        "2026-09-01T00:00:00Z",
        "2026-10-01T00:00:00Z",
        now.getTime() - 1,
      );
      await send("RENEWAL", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z", now.getTime());
      let [grant] = await db.select().from(entitlement).where(eq(entitlement.userId, userId));
      expect(grant?.validFrom?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
      expect(grant?.validUntil?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
      await send("RENEWAL", "2027-01-01T00:00:00Z", "2027-02-01T00:00:00Z", now.getTime() + 1);
      [grant] = await db.select().from(entitlement).where(eq(entitlement.userId, userId));
      expect(grant?.validFrom?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    }));
  test("keeps paid and grace access until expiration, rejects stale renewal, and deduplicates", () =>
    withFixture(async (db, userId) => {
      const project = createRevenueCatWebhookProcessor({
        db,
        config: {
          enabled: true,
          authorization: "test-webhook-authorization",
          signatureToleranceSeconds: 300,
          allowedEnvironment: "PRODUCTION",
          entitlementMap: { pro: "pro" },
        },
      });
      const transactionId = crypto.randomUUID();
      const now = new Date("2026-09-10T00:00:00Z");
      const event = (type: string, timestamp: number, extra: Record<string, unknown> = {}) => ({
        api_version: "1.0",
        event: {
          id: crypto.randomUUID(),
          type,
          event_timestamp_ms: timestamp,
          app_user_id: userId,
          product_id: "monthly",
          entitlement_ids: ["pro"],
          original_transaction_id: transactionId,
          environment: "PRODUCTION",
          purchased_at_ms: Date.parse("2026-09-01T00:00:00Z"),
          expiration_at_ms: Date.parse("2026-10-01T00:00:00Z"),
          ...extra,
        },
      });
      const send = (payload: ReturnType<typeof event>) =>
        project({
          authorization: "test-webhook-authorization",
          signature: null,
          now,
          rawBody: JSON.stringify(payload),
        });
      const status = async () =>
        (await db.select().from(entitlement).where(eq(entitlement.userId, userId)))[0];
      const purchase = event("INITIAL_PURCHASE", now.getTime());
      expect(await send(purchase)).toEqual({ duplicate: false, projected: true });
      expect(await send(purchase)).toEqual({ duplicate: true, projected: false });
      await send(event("SUBSCRIPTION_PAUSED", now.getTime() + 1));
      expect((await status())?.status).toBe("active");
      await send(
        event("BILLING_ISSUE", now.getTime() + 2, {
          expiration_at_ms: now.getTime() - 1,
          grace_period_expiration_at_ms: Date.parse("2026-09-13T00:00:00Z"),
        }),
      );
      expect((await status())?.status).toBe("active");
      expect((await status())?.validUntil?.toISOString()).toBe("2026-09-13T00:00:00.000Z");
      await send(event("EXPIRATION", now.getTime() + 3));
      await send(event("RENEWAL", now.getTime() + 1));
      expect((await status())?.status).toBe("expired");
      const events = await db
        .select()
        .from(billingWebhookEvent)
        .where(eq(billingWebhookEvent.eventKey, purchase.event.id));
      expect(events).toHaveLength(1);
    }));
});
