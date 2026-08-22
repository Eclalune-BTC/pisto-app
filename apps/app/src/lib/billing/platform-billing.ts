import { getBillingCapabilities } from "@/lib/billing/billing-policy";
import type { PlatformBillingAdapter } from "@/lib/billing/platform-billing.types";

const unavailableMessage =
  "Native purchases are not configured yet. Existing access will still appear here.";

export const platformBilling: PlatformBillingAdapter = {
  capabilities: getBillingCapabilities("ios"),
  async manage() {
    return { status: "unavailable", message: unavailableMessage };
  },
  async purchase() {
    return { status: "unavailable", message: unavailableMessage };
  },
};
