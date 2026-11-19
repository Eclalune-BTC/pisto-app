import type { BillingCapabilities } from "@/lib/billing/billing-policy";

type BillingUnavailableReason = "native-store-not-configured";

type BillingActionResult =
  | { status: "opened" }
  | { status: "unavailable"; reason: BillingUnavailableReason };

export type PlatformBillingAdapter = {
  capabilities: BillingCapabilities;
  manage(): Promise<BillingActionResult>;
  purchase(slug: string): Promise<BillingActionResult>;
};
