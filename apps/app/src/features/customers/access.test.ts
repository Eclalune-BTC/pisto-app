import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/queries/businesses", () => ({
  businessesQueryOptions: {},
  getActiveBusiness: () => undefined,
}));

import { type CapabilityAccess, capabilityBoundaryState } from "./access";

describe("customer and receivable access recovery", () => {
  const access: CapabilityAccess = {
    business: undefined,
    canManage: false,
    canRead: false,
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
});
