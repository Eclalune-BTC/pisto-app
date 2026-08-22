import { describe, expect, test } from "bun:test";
import { getTableColumns, getTableName } from "drizzle-orm";

import {
  account,
  businessSettings,
  entitlement,
  invitation,
  member,
  organization,
  rateLimit,
  sale,
  saleOperation,
  session,
  user,
  verification,
} from "../src/schema/index.ts";

describe("database schema", () => {
  test("contains every Better Auth core and organization table", () => {
    expect(
      [user, session, account, verification, rateLimit, organization, member, invitation]
        .map(getTableName)
        .sort(),
    ).toEqual([
      "account",
      "invitation",
      "member",
      "organization",
      "rateLimit",
      "session",
      "user",
      "verification",
    ]);
  });

  test("stores the active organization on the session", () => {
    expect(getTableColumns(session)).toHaveProperty("activeOrganizationId");
  });

  test("persists Better Auth rate limits across API instances", () => {
    const columns = getTableColumns(rateLimit);

    expect(columns).toHaveProperty("key");
    expect(columns).toHaveProperty("count");
    expect(columns).toHaveProperty("lastRequest");
  });

  test("keeps user and organization entitlement subjects explicit", () => {
    const columns = getTableColumns(entitlement);

    expect(columns).toHaveProperty("userId");
    expect(columns).toHaveProperty("organizationId");
  });

  test("stores business settings and total-only sales in tenant-owned tables", () => {
    expect(getTableName(businessSettings)).toBe("business_settings");
    expect(getTableColumns(businessSettings)).toHaveProperty("timeZone");
    expect(getTableColumns(businessSettings)).toHaveProperty("currencyMinorUnitDigits");
    expect(getTableColumns(sale)).toHaveProperty("grossMinorUnits");
    expect(getTableColumns(sale)).toHaveProperty("occurredAt");
    expect(getTableColumns(sale)).toHaveProperty("occurredLocalDate");
    expect(getTableColumns(sale)).toHaveProperty("occurredLocalTime");
    expect(getTableColumns(sale)).toHaveProperty("timeZone");
    expect(getTableColumns(saleOperation)).toHaveProperty("idempotencyKey");
  });
});
