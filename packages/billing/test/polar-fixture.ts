import type { Database } from "@pisto/db";
import type { PolarBillingConfig } from "../src/config.ts";
import { createPolarIntegration } from "../src/polar.ts";

export const polarTestProductId = "12345678-1234-4234-8234-123456789012";

export const polarTestConfig = {
  enabled: true,
  accessToken: "test-token",
  webhookSecret: "whsec_dGVzdC13ZWJob29rLXNlY3JldA==",
  server: "sandbox",
  products: [{ productId: polarTestProductId, slug: "pro", entitlementKey: "pro" }],
  successUrl: "http://localhost:8090/billing/success",
} satisfies Extract<PolarBillingConfig, { enabled: true }>;

export function polarTestIntegration(db: Database = {} as never) {
  const integration = createPolarIntegration({ db, config: polarTestConfig });
  if (!integration.client || !integration.plugin)
    throw new Error("Expected enabled test integration");
  return { ...integration, client: integration.client, plugin: integration.plugin };
}

export const polarTestPayload = {
  type: "subscription.active",
  timestamp: "2026-09-01T00:00:00Z",
  data: {
    id: "subscription",
    product_id: polarTestProductId,
    customer_id: "customer",
    status: "active",
    current_period_start: "2026-09-01T00:00:00Z",
    current_period_end: "2026-10-01T00:00:00Z",
    cancel_at_period_end: false,
    metadata: {},
    customer: { id: "customer", external_id: "user" },
  },
};
