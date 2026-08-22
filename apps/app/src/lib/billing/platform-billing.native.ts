import { Platform } from "react-native";

import { getBillingCapabilities, type RuntimePlatform } from "@/lib/billing/billing-policy";
import type { PlatformBillingAdapter } from "@/lib/billing/platform-billing.types";

export const platformBilling: PlatformBillingAdapter = {
  capabilities: getBillingCapabilities(Platform.OS as RuntimePlatform),
  async manage() {
    return { status: "unavailable", reason: "native-store-not-configured" };
  },
  async purchase() {
    return { status: "unavailable", reason: "native-store-not-configured" };
  },
};
