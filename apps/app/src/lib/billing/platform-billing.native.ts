import { Platform } from "react-native";

import { getBillingCapabilities, type RuntimePlatform } from "@/lib/billing/billing-policy";
import type { PlatformBillingAdapter } from "@/lib/billing/platform-billing.types";

const unavailableMessage =
  "Purchases are not available in this build. Connect an App Store or Play billing adapter before release.";

export const platformBilling: PlatformBillingAdapter = {
  capabilities: getBillingCapabilities(Platform.OS as RuntimePlatform),
  async manage() {
    return { status: "unavailable", message: unavailableMessage };
  },
  async purchase() {
    return { status: "unavailable", message: unavailableMessage };
  },
};
