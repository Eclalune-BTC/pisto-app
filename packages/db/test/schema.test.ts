import { describe, expect, test } from "bun:test";
import { getTableColumns, getTableName } from "drizzle-orm";

import {
  account,
  entitlement,
  invitation,
  member,
  organization,
  rateLimit,
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
});
