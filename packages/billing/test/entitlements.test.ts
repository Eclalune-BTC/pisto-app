import { describe, expect, test } from "bun:test";

import { isEntitlementEffective } from "../src/entitlements.ts";

describe("entitlement validity", () => {
  const now = new Date("2026-08-22T12:00:00.000Z");

  test("accepts an active entitlement inside its validity window", () => {
    expect(
      isEntitlementEffective(
        {
          status: "active",
          validFrom: new Date("2026-08-21T12:00:00.000Z"),
          validUntil: new Date("2026-08-23T12:00:00.000Z"),
        },
        now,
      ),
    ).toBe(true);
  });

  test("rejects an entitlement exactly at its exclusive expiry boundary", () => {
    expect(
      isEntitlementEffective({ status: "active", validFrom: null, validUntil: now }, now),
    ).toBe(false);
  });

  test("rejects a future or inactive entitlement", () => {
    expect(
      isEntitlementEffective(
        {
          status: "active",
          validFrom: new Date("2026-08-23T12:00:00.000Z"),
          validUntil: null,
        },
        now,
      ),
    ).toBe(false);
    expect(
      isEntitlementEffective({ status: "pending", validFrom: null, validUntil: null }, now),
    ).toBe(false);
  });
});
