import type { BusinessPermission } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

import { getVisibleOperateModules, OPERATE_MODULES } from "@/features/operate/navigation";

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
});
