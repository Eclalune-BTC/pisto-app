import { z } from "zod";

const enabledValues = new Set(["1", "true", "yes", "on"]);
const disabledValues = new Set(["0", "false", "no", "off", ""]);

export interface BillingProduct {
  productId: string;
  slug: string;
  entitlementKey: string;
  name?: string;
  description?: string;
}

export type PolarBillingConfig =
  | { enabled: false }
  | {
      enabled: true;
      accessToken: string;
      webhookSecret: string;
      server: "sandbox" | "production";
      products: BillingProduct[];
      successUrl: string;
      returnUrl?: string;
      theme?: "light" | "dark";
    };

export type RevenueCatBillingConfig =
  | { enabled: false }
  | {
      enabled: true;
      authorization: string;
      signingSecret?: string;
      signatureToleranceSeconds: number;
      entitlementMap: Record<string, string>;
    };

export interface BillingConfig {
  polar: PolarBillingConfig;
  revenueCat: RevenueCatBillingConfig;
}

export class BillingConfigurationError extends Error {
  override readonly name = "BillingConfigurationError";
}

function isReservedProductionHostname(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0") return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(normalized)) return true;
  return [
    "localhost",
    "test",
    "invalid",
    "example",
    "example.com",
    "example.net",
    "example.org",
  ].some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

const productSchema = z
  .object({
    productId: z.string().uuid(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    entitlementKey: z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    name: z.string().min(1).max(120).optional(),
    description: z.string().min(1).max(500).optional(),
  })
  .strict();

const productsSchema = z
  .array(productSchema)
  .min(1)
  .superRefine((products, ctx) => {
    for (const field of ["productId", "slug"] as const) {
      const seen = new Set<string>();
      for (const [index, product] of products.entries()) {
        if (seen.has(product[field])) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate ${field}: ${product[field]}`,
            path: [index, field],
          });
        }
        seen.add(product[field]);
      }
    }
  });

function parseEnabled(value: string | undefined, variable: string): boolean {
  const normalized = value?.trim().toLowerCase() ?? "false";
  if (enabledValues.has(normalized)) return true;
  if (disabledValues.has(normalized)) return false;
  throw new BillingConfigurationError(
    `${variable} must be one of true, false, 1, 0, yes, no, on, or off`,
  );
}

function requireValue(env: Record<string, string | undefined>, variable: string): string {
  const value = env[variable]?.trim();
  if (!value) {
    throw new BillingConfigurationError(
      `${variable} is required when its billing integration is enabled`,
    );
  }
  return value;
}

function parseHttpUrl(value: string, variable: string, production: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BillingConfigurationError(`${variable} must be an absolute URL`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new BillingConfigurationError(`${variable} must use HTTP or HTTPS`);
  }
  if (production && url.protocol !== "https:") {
    throw new BillingConfigurationError(`${variable} must use HTTPS in production`);
  }
  if (url.username || url.password) {
    throw new BillingConfigurationError(`${variable} cannot contain URL credentials`);
  }
  if (production && isReservedProductionHostname(url.hostname)) {
    throw new BillingConfigurationError(
      `${variable} cannot use a reserved or example hostname in production`,
    );
  }
  return url.toString();
}

function parseProducts(value: string): BillingProduct[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BillingConfigurationError("POLAR_PRODUCTS_JSON must be valid JSON");
  }
  const result = productsSchema.safeParse(parsed);
  if (!result.success) {
    throw new BillingConfigurationError(
      `POLAR_PRODUCTS_JSON is invalid: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

function parseEntitlementMap(value: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new BillingConfigurationError("REVENUECAT_ENTITLEMENT_MAP_JSON must be valid JSON");
  }
  const result = z
    .record(z.string().min(1), z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/))
    .refine((map) => Object.keys(map).length > 0, "At least one mapping is required")
    .safeParse(parsed);
  if (!result.success) {
    throw new BillingConfigurationError(
      `REVENUECAT_ENTITLEMENT_MAP_JSON is invalid: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

export function parseBillingConfig(env: Record<string, string | undefined>): BillingConfig {
  const production = (env.NODE_ENV ?? "development") === "production";
  const polarEnabled = parseEnabled(env.BILLING_ENABLED, "BILLING_ENABLED");
  const revenueCatEnabled = parseEnabled(env.REVENUECAT_ENABLED, "REVENUECAT_ENABLED");

  const polar: PolarBillingConfig = polarEnabled
    ? {
        enabled: true,
        accessToken: requireValue(env, "POLAR_ACCESS_TOKEN"),
        webhookSecret: requireValue(env, "POLAR_WEBHOOK_SECRET"),
        server: z.enum(["sandbox", "production"]).parse(env.POLAR_SERVER?.trim() || "sandbox"),
        products: parseProducts(requireValue(env, "POLAR_PRODUCTS_JSON")),
        successUrl: parseHttpUrl(
          requireValue(env, "POLAR_SUCCESS_URL"),
          "POLAR_SUCCESS_URL",
          production,
        ),
        ...(env.POLAR_RETURN_URL?.trim()
          ? {
              returnUrl: parseHttpUrl(env.POLAR_RETURN_URL.trim(), "POLAR_RETURN_URL", production),
            }
          : {}),
        ...(env.POLAR_THEME?.trim()
          ? { theme: z.enum(["light", "dark"]).parse(env.POLAR_THEME.trim()) }
          : {}),
      }
    : { enabled: false };

  const revenueCat: RevenueCatBillingConfig = revenueCatEnabled
    ? {
        enabled: true,
        authorization: requireValue(env, "REVENUECAT_WEBHOOK_AUTHORIZATION"),
        ...(env.REVENUECAT_WEBHOOK_SIGNING_SECRET?.trim()
          ? { signingSecret: env.REVENUECAT_WEBHOOK_SIGNING_SECRET.trim() }
          : {}),
        signatureToleranceSeconds: z.coerce
          .number()
          .int()
          .min(30)
          .max(3600)
          .parse(env.REVENUECAT_SIGNATURE_TOLERANCE_SECONDS ?? "300"),
        entitlementMap: parseEntitlementMap(requireValue(env, "REVENUECAT_ENTITLEMENT_MAP_JSON")),
      }
    : { enabled: false };

  return { polar, revenueCat };
}
