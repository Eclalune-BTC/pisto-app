import type { BillingCapabilities } from "@/lib/billing/billing-policy";

export type BillingActionResult = { status: "opened" } | { status: "unavailable"; message: string };

export type PlatformBillingAdapter = {
  capabilities: BillingCapabilities;
  manage(): Promise<BillingActionResult>;
  purchase(slug: string): Promise<BillingActionResult>;
};
