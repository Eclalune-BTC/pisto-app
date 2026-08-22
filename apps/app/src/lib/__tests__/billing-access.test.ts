import { describe, expect, test } from "vitest";

import { deriveBillingAccessState } from "@/lib/billing/billing-access";

const settled = {
  fetchStatus: "idle" as const,
  isError: false,
  isPending: false,
};

describe("billing access presentation", () => {
  test("requires a fresh post-checkout verification before trusting cached access", () => {
    expect(
      deriveBillingAccessState({
        ...settled,
        activeCount: 1,
        verifiedAfterReturn: false,
      }),
    ).toBe("checking");
  });

  test("does not present cached active access during refresh, failure, or offline pause", () => {
    expect(
      deriveBillingAccessState({
        ...settled,
        activeCount: 1,
        fetchStatus: "fetching",
      }),
    ).toBe("checking");
    expect(deriveBillingAccessState({ ...settled, activeCount: 1, isError: true })).toBe("unknown");
    expect(deriveBillingAccessState({ ...settled, activeCount: 1, fetchStatus: "paused" })).toBe(
      "unknown",
    );
  });

  test("returns active or standard only from a settled successful query", () => {
    expect(deriveBillingAccessState({ ...settled, activeCount: 1 })).toBe("active");
    expect(deriveBillingAccessState({ ...settled, activeCount: 0 })).toBe("standard");
  });
});
