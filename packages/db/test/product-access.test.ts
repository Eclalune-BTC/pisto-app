import { describe, expect, test } from "bun:test";

import {
  businessRoles,
  hasBusinessPermission,
  resolveBusinessAccess,
  rolesWithBusinessPermission,
} from "../src/product-access.ts";

describe("Pisto business access policy", () => {
  test("maps only the three approved exact membership roles", () => {
    expect(businessRoles).toEqual(["owner", "admin", "member"]);
    expect(resolveBusinessAccess("owner")?.permissions).toContain("business:configure");
    expect(resolveBusinessAccess("admin")?.permissions).not.toContain("business:configure");
    expect(resolveBusinessAccess("member")?.permissions).not.toContain("business:configure");
    expect(resolveBusinessAccess("cashier")).toBeNull();
    expect(resolveBusinessAccess("owner,admin")).toBeNull();
  });

  test("grants current sales operations without granting business configuration", () => {
    for (const role of businessRoles) {
      expect(hasBusinessPermission(role, "business:read")).toBe(true);
      expect(hasBusinessPermission(role, "sales:create")).toBe(true);
      expect(hasBusinessPermission(role, "sales:read")).toBe(true);
      expect(hasBusinessPermission(role, "sales:summary:read")).toBe(true);
    }
    expect(rolesWithBusinessPermission("business:configure")).toEqual(["owner"]);
  });

  test("fails closed for unsupported and composite membership values", () => {
    expect(hasBusinessPermission("accountant", "sales:read")).toBe(false);
    expect(hasBusinessPermission("owner,member", "business:configure")).toBe(false);
  });
});
