import type { BillingCatalogProduct, BillingCatalogResponse } from "@pisto/contracts";

import type { BillingCapabilities } from "@/lib/billing/billing-policy";

export type BillingOffer =
  | { kind: "available"; products: BillingCatalogProduct[] }
  | { kind: "checking" }
  | { kind: "disabled" }
  | { kind: "empty" }
  | { kind: "not-offered-here" }
  | { kind: "unknown" }
  | { kind: "unresolved" };

type CatalogRead = {
  data: BillingCatalogResponse["data"] | undefined;
  fetchStatus: "fetching" | "idle" | "paused";
  isError: boolean;
};

/**
 * What this platform may offer for purchase. Products appear only from a successful read of an
 * enabled catalog on a channel that can purchase: a native build never falls back to web checkout,
 * and a catalog that could not be refreshed is no basis for a purchase decision.
 */
export function deriveBillingOffer(
  capabilities: BillingCapabilities,
  catalog: CatalogRead,
): BillingOffer {
  if (capabilities.channel === "unresolved") return { kind: "unresolved" };
  if (!capabilities.canPurchase) return { kind: "not-offered-here" };
  if (catalog.isError || catalog.fetchStatus === "paused") return { kind: "unknown" };
  if (!catalog.data) return { kind: "checking" };
  if (catalog.data.status === "disabled") return { kind: "disabled" };
  if (catalog.data.products.length === 0) return { kind: "empty" };
  return { kind: "available", products: catalog.data.products };
}
