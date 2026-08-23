import { describe, expect, test } from "bun:test";

import {
  isRevenueCatEnvironmentAllowed,
  isRevenueCatEventProjectable,
  revenueCatEventStatus,
  revenueCatWebhookSchema,
} from "../src/revenuecat.ts";

describe("RevenueCat webhook projection", () => {
  test("parses stable event identity and entitlement fields", () => {
    const result = revenueCatWebhookSchema.safeParse({
      api_version: "1.0",
      event: {
        id: "event-1",
        type: "INITIAL_PURCHASE",
        event_timestamp_ms: 1_800_000_000_000,
        app_user_id: "user-1",
        product_id: "native-pro-monthly",
        entitlement_ids: ["pro"],
      },
    });

    expect(result.success).toBe(true);
  });

  test("keeps cancellation access active until expiration", () => {
    const now = new Date("2026-08-22T12:00:00.000Z");
    const expiresAt = new Date("2026-09-22T12:00:00.000Z");

    expect(revenueCatEventStatus("CANCELLATION", expiresAt, now)).toBe("active");
    expect(isRevenueCatEventProjectable("TRANSFER")).toBe(false);
  });

  test("revokes refunded entitlements", () => {
    expect(revenueCatEventStatus("REFUND", null, new Date())).toBe("revoked");
  });

  test("does not grant a paused subscription", () => {
    expect(revenueCatEventStatus("SUBSCRIPTION_PAUSED", null, new Date())).toBe("inactive");
  });
});

describe("RevenueCat store environment", () => {
  test("projects only events from the configured environment", () => {
    expect(isRevenueCatEnvironmentAllowed("PRODUCTION", "PRODUCTION")).toBe(true);
    expect(isRevenueCatEnvironmentAllowed("SANDBOX", "PRODUCTION")).toBe(false);
    expect(isRevenueCatEnvironmentAllowed("SANDBOX", "SANDBOX")).toBe(true);
    expect(isRevenueCatEnvironmentAllowed("PRODUCTION", "SANDBOX")).toBe(false);
  });

  test("refuses an event that does not name its environment", () => {
    expect(isRevenueCatEnvironmentAllowed(undefined, "PRODUCTION")).toBe(false);
    expect(isRevenueCatEnvironmentAllowed("", "PRODUCTION")).toBe(false);
    expect(isRevenueCatEnvironmentAllowed("   ", "PRODUCTION")).toBe(false);
    expect(isRevenueCatEnvironmentAllowed("STAGING", "PRODUCTION")).toBe(false);
    expect(isRevenueCatEnvironmentAllowed(undefined, "SANDBOX")).toBe(false);
  });

  test("does not let casing or padding smuggle a sandbox purchase through", () => {
    expect(isRevenueCatEnvironmentAllowed(" sandbox ", "PRODUCTION")).toBe(false);
    expect(isRevenueCatEnvironmentAllowed("Sandbox", "PRODUCTION")).toBe(false);
  });
});
