import { describe, expect, test } from "vitest";

import { deriveBillingOffer } from "@/lib/billing/billing-offer";
import { getBillingCapabilities } from "@/lib/billing/billing-policy";

const web = getBillingCapabilities("web");
const product = { slug: "pisto-plus-monthly", name: "Pisto Plus" };

function read(data: Parameters<typeof deriveBillingOffer>[1]["data"]) {
  return { data, fetchStatus: "idle" as const, isError: false };
}

describe("billing offer", () => {
  test("offers products only from an enabled catalog on a channel that can purchase", () => {
    expect(
      deriveBillingOffer(web, read({ status: "enabled", provider: "polar", products: [product] })),
    ).toEqual({ kind: "available", products: [product] });
  });

  test("states that billing is disabled instead of showing any product or checkout", () => {
    expect(
      deriveBillingOffer(web, read({ status: "disabled", provider: null, products: [] })),
    ).toEqual({ kind: "disabled" });
    // Even a product slipping through a disabled catalog is never offered.
    expect(
      deriveBillingOffer(web, read({ status: "disabled", provider: null, products: [product] })),
    ).toEqual({ kind: "disabled" });
  });

  test("separates an empty enabled catalog from a disabled one", () => {
    expect(
      deriveBillingOffer(web, read({ status: "enabled", provider: "polar", products: [] })),
    ).toEqual({ kind: "empty" });
  });

  test("never substitutes web checkout on a native build", () => {
    const catalog = read({ status: "enabled", provider: "polar", products: [product] });
    expect(deriveBillingOffer(getBillingCapabilities("ios"), catalog)).toEqual({
      kind: "not-offered-here",
    });
    expect(deriveBillingOffer(getBillingCapabilities("android"), catalog)).toEqual({
      kind: "not-offered-here",
    });
    expect(
      deriveBillingOffer({ canManage: false, canPurchase: false, channel: "unresolved" }, catalog),
    ).toEqual({ kind: "unresolved" });
  });

  test("does not offer a cached catalog that failed or paused while refreshing", () => {
    const cached = { status: "enabled" as const, provider: "polar" as const, products: [product] };
    expect(deriveBillingOffer(web, { ...read(cached), isError: true })).toEqual({
      kind: "unknown",
    });
    expect(deriveBillingOffer(web, { ...read(cached), fetchStatus: "paused" })).toEqual({
      kind: "unknown",
    });
    expect(deriveBillingOffer(web, { ...read(undefined), fetchStatus: "fetching" })).toEqual({
      kind: "checking",
    });
  });
});
