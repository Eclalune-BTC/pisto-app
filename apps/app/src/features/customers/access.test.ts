import type { Business } from "@pisto/contracts";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: {},
  getActiveBusiness: () => undefined,
}));

import {
  type CapabilityAccess,
  capabilityBoundaryState,
  manageCapabilityBoundaryState,
} from "./access";

describe("customer and receivable access recovery", () => {
  const access: CapabilityAccess = {
    business: undefined,
    canManage: false,
    canRead: false,
    hasManagePermission: false,
    isDenied: false,
    isError: false,
    isOffline: false,
    isPending: true,
    isStale: false,
    refetch: async () => undefined,
  };

  test("shows offline recovery instead of an endless pending spinner", () => {
    expect(capabilityBoundaryState({ ...access, isOffline: true })).toBe("offline");
    expect(capabilityBoundaryState(access)).toBe("loading");
    expect(capabilityBoundaryState({ ...access, isPending: false, isError: true })).toBe("error");
  });

  test("hides cached access after a rejection even when another read is paused", () => {
    expect(
      capabilityBoundaryState({ ...access, isDenied: true, isOffline: true, canRead: true }),
    ).toBe("denied");
  });

  test("keeps a command route mounted while granted access only fails to refresh", () => {
    const stale: CapabilityAccess = {
      ...access,
      business: { id: "business-a" } as Business,
      canManage: false,
      canRead: true,
      hasManagePermission: true,
      isPending: false,
      isStale: true,
    };
    expect(manageCapabilityBoundaryState(stale)).toBe("ready");
    expect(manageCapabilityBoundaryState({ ...stale, hasManagePermission: false })).toBe("denied");
    expect(manageCapabilityBoundaryState({ ...stale, isDenied: true })).toBe("denied");
  });
});
