import type { PlatformBillingAdapter } from "@/lib/billing/platform-billing.types";

const resolutionError =
  "Platform billing adapter resolution failed. Expected the .web or .native implementation.";

export const platformBilling: PlatformBillingAdapter = {
  capabilities: {
    canManage: false,
    canPurchase: false,
    channel: "unresolved",
  },
  async manage() {
    throw new Error(resolutionError);
  },
  async purchase() {
    throw new Error(resolutionError);
  },
};
