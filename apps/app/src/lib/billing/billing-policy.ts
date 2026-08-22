import { billingCheckoutRequestSchema } from "@pisto/contracts";

export type RuntimePlatform = "android" | "ios" | "web" | "windows" | "macos";

export type BillingCapabilities = {
  canManage: boolean;
  canPurchase: boolean;
  channel: "web-checkout" | "native-store-placeholder";
};

export function getBillingCapabilities(platform: RuntimePlatform): BillingCapabilities {
  if (platform === "web") {
    return {
      canManage: true,
      canPurchase: true,
      channel: "web-checkout",
    };
  }

  return {
    canManage: false,
    canPurchase: false,
    channel: "native-store-placeholder",
  };
}

export function assertCatalogSlug(slug: string): string {
  const parsed = billingCheckoutRequestSchema.safeParse({ slug });

  if (!parsed.success) {
    throw new Error("The selected billing product is invalid.");
  }

  return parsed.data.slug;
}

export function assertSafeCheckoutUrl(value: string): string {
  const url = new URL(value);
  const isLocalDevelopment =
    url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");

  if (url.protocol !== "https:" && !isLocalDevelopment) {
    throw new Error("The checkout destination must use HTTPS.");
  }

  return url.toString();
}
