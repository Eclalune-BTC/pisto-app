import { describe, expect, it } from "vitest";

import {
  assertCatalogSlug,
  assertSafeCheckoutUrl,
  getBillingCapabilities,
} from "@/lib/billing/billing-policy";

describe("billing platform policy", () => {
  it("enables server checkout only on web", () => {
    expect(getBillingCapabilities("web")).toMatchObject({
      canPurchase: true,
      channel: "web-checkout",
    });
    expect(getBillingCapabilities("ios")).toMatchObject({
      canPurchase: false,
      channel: "native-store-placeholder",
    });
    expect(getBillingCapabilities("android").canPurchase).toBe(false);
  });

  it("accepts only bounded catalog slugs", () => {
    expect(assertCatalogSlug("pisto-plus-monthly")).toBe("pisto-plus-monthly");
    expect(() => assertCatalogSlug("pisto_plus-monthly")).toThrow();
    expect(() => assertCatalogSlug("https://example.com/checkout")).toThrow();
  });

  it("allows secure checkout URLs and local development only", () => {
    expect(assertSafeCheckoutUrl("https://checkout.example.com/session")).toContain("https://");
    expect(assertSafeCheckoutUrl("http://localhost:3001/session")).toContain("localhost");
    expect(() => assertSafeCheckoutUrl("http://checkout.example.com/session")).toThrow();
  });
});
