import type { BillingCapabilities } from "@/lib/billing/billing-policy";

export type BillingUnavailableReason = "native-store-not-configured";

export type BillingActionResult =
  | { status: "opened" }
  | { status: "unavailable"; reason: BillingUnavailableReason };

export type PlatformBillingAdapter = {
  capabilities: BillingCapabilities;
  manage(): Promise<BillingActionResult>;
  purchase(slug: string): Promise<BillingActionResult>;
};
