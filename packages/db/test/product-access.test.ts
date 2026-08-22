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

  test("keeps sensitive operating-core management away from members", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(hasBusinessPermission(role, "catalog:manage")).toBe(true);
      expect(hasBusinessPermission(role, "inventory:manage")).toBe(true);
      expect(hasBusinessPermission(role, "expenses:manage")).toBe(true);
      expect(hasBusinessPermission(role, "cash:manage")).toBe(true);
      expect(hasBusinessPermission(role, "customers:manage")).toBe(true);
      expect(hasBusinessPermission(role, "receivables:manage")).toBe(true);
      expect(hasBusinessPermission(role, "reports:read")).toBe(true);
    }

    expect(hasBusinessPermission("member", "catalog:read")).toBe(true);
    expect(hasBusinessPermission("member", "inventory:read")).toBe(true);
    expect(hasBusinessPermission("member", "assistant:use")).toBe(true);
    expect(hasBusinessPermission("member", "catalog:manage")).toBe(false);
    expect(hasBusinessPermission("member", "expenses:read")).toBe(false);
    expect(hasBusinessPermission("member", "cash:read")).toBe(false);
    expect(hasBusinessPermission("member", "customers:read")).toBe(false);
    expect(hasBusinessPermission("member", "receivables:read")).toBe(false);
    expect(hasBusinessPermission("member", "reports:read")).toBe(false);
  });

  test("fails closed for unsupported and composite membership values", () => {
    expect(hasBusinessPermission("accountant", "sales:read")).toBe(false);
    expect(hasBusinessPermission("owner,member", "business:configure")).toBe(false);
  });
});
