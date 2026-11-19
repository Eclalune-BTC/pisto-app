import { describe, expect, test } from "vitest";
import { currentDestination } from "@/components/shell/current-destination";
import { OPERATE_MODULES } from "@/features/operate/navigation";
import {
  OPERATE_ROOT,
  OPERATE_ROUTE_PARENTS,
  type OperateRoute,
} from "@/features/operate/route-parents";

const moduleRoutes = OPERATE_MODULES.map(({ href }) => String(href));

describe("current navigation destination", () => {
  test("every declared operate route belongs to Home or to exactly one module", () => {
    const destinations = new Set([OPERATE_ROOT, ...moduleRoutes]);
    for (const route of [OPERATE_ROOT, ...Object.keys(OPERATE_ROUTE_PARENTS)] as OperateRoute[]) {
      expect(destinations.has(currentDestination(route) ?? ""), route).toBe(true);
    }
  });

  test("follows the declared parent when the path names another module", () => {
    expect(currentDestination("/operate/purchases/new")).toBe("/operate/payables");
    expect(currentDestination("/operate/purchases/[purchaseId]")).toBe("/operate/payables");
    expect(currentDestination("/operate/cash/adjustments/new")).toBe("/operate/cash");
  });

  test("keeps a module on itself and a page opened from Home on Home", () => {
    for (const route of moduleRoutes) {
      expect(currentDestination(route as OperateRoute)).toBe(route);
    }
    expect(currentDestination(OPERATE_ROOT)).toBe(OPERATE_ROOT);
    expect(currentDestination("/operate/assistant/review")).toBe(OPERATE_ROOT);
  });

  test("resolves account pages to themselves and an unknown route to nothing", () => {
    expect(currentDestination("/settings")).toBe("/settings");
    expect(currentDestination("/billing/success")).toBe("/billing");
    expect(currentDestination(null)).toBeNull();
  });
});
