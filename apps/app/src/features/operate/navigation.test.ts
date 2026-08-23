import type { BusinessPermission } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

import {
  getVisibleOperateModules,
  OPERATE_GROUPS,
  OPERATE_MODULES,
} from "@/features/operate/navigation";

describe("operate navigation", () => {
  test("exposes only modules the active membership may read", () => {
    const permissions: BusinessPermission[] = [
      "business:read",
      "sales:read",
      "inventory:read",
      "customers:read",
    ];

    expect(getVisibleOperateModules(permissions).map(({ id }) => id)).toEqual([
      "sales",
      "inventory",
      "customers",
    ]);
  });

  test("keeps the explicit product order when every read permission is granted", () => {
    const permissions = OPERATE_MODULES.map(({ permission }) => permission);

    expect(getVisibleOperateModules(permissions).map(({ id }) => id)).toEqual(
      OPERATE_MODULES.map(({ id }) => id),
    );
  });

  test("does not invent destinations without an active membership", () => {
    expect(getVisibleOperateModules(undefined)).toEqual([]);
  });

  test("keeps reports behind its own read permission", () => {
    const withoutReports: BusinessPermission[] = ["business:read", "sales:read", "catalog:read"];

    expect(getVisibleOperateModules(withoutReports).map(({ id }) => id)).not.toContain("reports");
    expect(getVisibleOperateModules(["reports:read"]).map(({ id }) => id)).toEqual(["reports"]);
  });

  test("places every module in a declared group", () => {
    const groupIds = new Set(OPERATE_GROUPS.map(({ id }) => id));

    expect(OPERATE_MODULES.filter(({ group }) => !groupIds.has(group))).toEqual([]);
    expect(OPERATE_GROUPS.map(({ id }) => id)).toEqual([
      "money",
      "stock",
      "relationships",
      "insight",
    ]);
  });
});
