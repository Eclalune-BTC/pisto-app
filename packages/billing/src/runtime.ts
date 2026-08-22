import type { BillingCatalogProduct } from "@pisto/contracts";
import type { Database } from "@pisto/db";

import type { BillingConfig } from "./config.ts";
import { listEntitlements } from "./entitlements.ts";
import { createPolarIntegration } from "./polar.ts";
import { createRevenueCatWebhookProcessor } from "./revenuecat.ts";

export function createBillingRuntime(input: { config: BillingConfig; db: Database }) {
  const polar = createPolarIntegration({
    config: input.config.polar,
    db: input.db,
  });
  const processRevenueCatWebhook = createRevenueCatWebhookProcessor({
    config: input.config.revenueCat,
    db: input.db,
  });

  const catalog: BillingCatalogProduct[] = input.config.polar.enabled
    ? input.config.polar.products.map((product) => ({
        slug: product.slug,
        ...(product.name ? { name: product.name } : {}),
        ...(product.description ? { description: product.description } : {}),
      }))
    : [];

  return {
    config: input.config,
    polar,
    catalog,
    listEntitlements: (scope: Parameters<typeof listEntitlements>[1]) =>
      listEntitlements(input.db, scope),
    processRevenueCatWebhook,
  };
}

export type BillingRuntime = ReturnType<typeof createBillingRuntime>;
