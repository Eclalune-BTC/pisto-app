import { describe, expect, test } from "bun:test";

import { BillingConfigurationError, parseBillingConfig } from "../src/config.ts";

describe("billing configuration", () => {
  test("rejects an unknown environment even when providers are disabled", () => {
    for (const NODE_ENV of ["prod", "staging", "", "production "]) {
      expect(() => parseBillingConfig({ NODE_ENV })).toThrow("NODE_ENV");
    }
  });
  test("is explicitly disabled without provider credentials", () => {
    expect(parseBillingConfig({})).toEqual({
      polar: { enabled: false },
      revenueCat: { enabled: false },
    });
  });

  test("fails closed when Polar is enabled without credentials", () => {
    expect(() => parseBillingConfig({ BILLING_ENABLED: "true" })).toThrow(
      BillingConfigurationError,
    );
  });

  test("parses an allowlisted Polar catalog", () => {
    const config = parseBillingConfig({
      BILLING_ENABLED: "true",
      POLAR_ACCESS_TOKEN: "configured-access-token",
      POLAR_WEBHOOK_SECRET: "configured-webhook-secret",
      POLAR_SERVER: "sandbox",
      POLAR_SUCCESS_URL: "https://app.example.test/billing/success",
      POLAR_PRODUCTS_JSON: JSON.stringify([
        {
          productId: "d8dd2de1-21b7-4a41-8bc3-ce909c0cfe23",
          slug: "pro",
          entitlementKey: "pro",
        },
      ]),
    });

    expect(config.polar.enabled).toBe(true);
    if (config.polar.enabled) {
      expect(config.polar.products[0]?.slug).toBe("pro");
    }
  });

  test("requires an explicit Polar API server instead of defaulting to sandbox", () => {
    const environment = {
      BILLING_ENABLED: "true",
      POLAR_ACCESS_TOKEN: "configured-access-token",
      POLAR_WEBHOOK_SECRET: "configured-webhook-secret",
      POLAR_SUCCESS_URL: "https://app.example.test/billing/success",
      POLAR_PRODUCTS_JSON: JSON.stringify([
        { productId: "d8dd2de1-21b7-4a41-8bc3-ce909c0cfe23", slug: "pro", entitlementKey: "pro" },
      ]),
    };
    for (const POLAR_SERVER of [undefined, "", "live", "Sandbox"]) {
      expect(() => parseBillingConfig({ ...environment, POLAR_SERVER })).toThrow(
        "POLAR_SERVER must be one of sandbox, production",
      );
    }
    const config = parseBillingConfig({ ...environment, POLAR_SERVER: "production" });
    expect(config.polar.enabled && config.polar.server).toBe("production");
  });

  test("accepts only exact boolean provider switches", () => {
    expect(parseBillingConfig({ BILLING_ENABLED: "false", REVENUECAT_ENABLED: "false" })).toEqual({
      polar: { enabled: false },
      revenueCat: { enabled: false },
    });
    for (const value of ["", "0", "off", "yes", "1", "TRUE"]) {
      expect(() => parseBillingConfig({ BILLING_ENABLED: value })).toThrow(
        "BILLING_ENABLED must be true or false",
      );
      expect(() => parseBillingConfig({ REVENUECAT_ENABLED: value })).toThrow(
        "REVENUECAT_ENABLED must be true or false",
      );
    }
  });

  test("fails closed when RevenueCat has no entitlement map", () => {
    expect(() =>
      parseBillingConfig({
        REVENUECAT_ENABLED: "true",
        REVENUECAT_WEBHOOK_AUTHORIZATION: "Bearer configured-value",
      }),
    ).toThrow(BillingConfigurationError);
  });

  test("requires HTTPS billing redirects in production", () => {
    expect(() =>
      parseBillingConfig({
        NODE_ENV: "production",
        BILLING_ENABLED: "true",
        POLAR_ACCESS_TOKEN: "configured-access-token",
        POLAR_WEBHOOK_SECRET: "configured-webhook-secret",
        POLAR_SERVER: "production",
        POLAR_PRODUCTS_JSON: JSON.stringify([
          {
            productId: "9dcb86e0-0e80-4a18-b354-4c1723c7e8cd",
            slug: "pro",
            entitlementKey: "pro",
          },
        ]),
        POLAR_SUCCESS_URL: "http://app.example.test/billing/success",
      }),
    ).toThrow("POLAR_SUCCESS_URL must use HTTPS in production");
  });

  test("rejects reserved Polar redirect hostnames in production", () => {
    const productJson = JSON.stringify([
      {
        productId: "9dcb86e0-0e80-4a18-b354-4c1723c7e8cd",
        slug: "pro",
        entitlementKey: "pro",
      },
    ]);
    const environment = {
      NODE_ENV: "production",
      BILLING_ENABLED: "true",
      POLAR_ACCESS_TOKEN: "configured-access-token",
      POLAR_WEBHOOK_SECRET: "configured-webhook-secret",
      POLAR_SERVER: "production",
      POLAR_PRODUCTS_JSON: productJson,
      POLAR_SUCCESS_URL: "https://app.pisto.dev/billing/success",
    };

    expect(() =>
      parseBillingConfig({
        ...environment,
        POLAR_SUCCESS_URL: "https://app.example.com/billing/success",
      }),
    ).toThrow("POLAR_SUCCESS_URL cannot use a reserved or example hostname");
    expect(() =>
      parseBillingConfig({
        ...environment,
        POLAR_RETURN_URL: "https://app.example.com/billing",
      }),
    ).toThrow("POLAR_RETURN_URL cannot use a reserved or example hostname");
  });
});
