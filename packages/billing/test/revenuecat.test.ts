import { describe, expect, test } from "bun:test";

import {
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
