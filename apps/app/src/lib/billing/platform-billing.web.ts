import { Linking } from "react-native";

import { api } from "@/lib/api-client";
import {
  assertCatalogSlug,
  assertSafeCheckoutUrl,
  getBillingCapabilities,
} from "@/lib/billing/billing-policy";
import type { PlatformBillingAdapter } from "@/lib/billing/platform-billing.types";

async function openServerRedirect(url: string) {
  await Linking.openURL(assertSafeCheckoutUrl(url));
  return { status: "opened" } as const;
}

export const platformBilling: PlatformBillingAdapter = {
  capabilities: getBillingCapabilities("web"),
  async manage() {
    const redirect = await api.billing.portal();
    return openServerRedirect(redirect.url);
  },
  async purchase(slug) {
    const redirect = await api.billing.checkout(assertCatalogSlug(slug));
    return openServerRedirect(redirect.url);
  },
};
