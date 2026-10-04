import { type Environment, type EnvironmentReader, readEnvironment } from "@pisto/config";
import { billingProductSlugSchema } from "@pisto/contracts";
import { z } from "zod";

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
      allowedEnvironment: "PRODUCTION" | "SANDBOX";
      entitlementMap: Record<string, string>;
    };

export interface BillingConfig {
  polar: PolarBillingConfig;
  revenueCat: RevenueCatBillingConfig;
}

export class BillingConfigurationError extends Error {
  override readonly name = "BillingConfigurationError";
}

const entitlementKeySchema = z.string().regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/);

const productSchema = z
  .object({
    productId: z.string().uuid(),
    slug: billingProductSlugSchema,
    entitlementKey: entitlementKeySchema,
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

function requireEnabledValue(read: EnvironmentReader, variable: string): string {
  return read.required(variable, "is required when its billing integration is enabled");
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
    .record(z.string().min(1), entitlementKeySchema)
    .refine((map) => Object.keys(map).length > 0, "At least one mapping is required")
    .safeParse(parsed);
  if (!result.success) {
    throw new BillingConfigurationError(
      `REVENUECAT_ENTITLEMENT_MAP_JSON is invalid: ${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

export function parseBillingConfig(env: Environment): BillingConfig {
  const read = readEnvironment(env, BillingConfigurationError);
  const returnUrl = read.optional("POLAR_RETURN_URL");
  const theme = read.optional("POLAR_THEME");
  const signingSecret = read.optional("REVENUECAT_WEBHOOK_SIGNING_SECRET");

  const polar: PolarBillingConfig = read.boolean("BILLING_ENABLED", false)
    ? {
        enabled: true,
        accessToken: requireEnabledValue(read, "POLAR_ACCESS_TOKEN"),
        webhookSecret: requireEnabledValue(read, "POLAR_WEBHOOK_SECRET"),
        // Access tokens are environment-specific; never guess the API server.
        server: read.enumValue("POLAR_SERVER", ["sandbox", "production"]),
        products: parseProducts(requireEnabledValue(read, "POLAR_PRODUCTS_JSON")),
        successUrl: read.httpUrl(
          requireEnabledValue(read, "POLAR_SUCCESS_URL"),
          "POLAR_SUCCESS_URL",
        ),
        ...(returnUrl ? { returnUrl: read.httpUrl(returnUrl, "POLAR_RETURN_URL") } : {}),
        ...(theme ? { theme: read.enumValue("POLAR_THEME", ["light", "dark"]) } : {}),
      }
    : { enabled: false };

  const revenueCat: RevenueCatBillingConfig = read.boolean("REVENUECAT_ENABLED", false)
    ? {
        enabled: true,
        authorization: requireEnabledValue(read, "REVENUECAT_WEBHOOK_AUTHORIZATION"),
        ...(signingSecret ? { signingSecret } : {}),
        signatureToleranceSeconds: read.integer("REVENUECAT_SIGNATURE_TOLERANCE_SECONDS", 300, {
          min: 30,
          max: 3600,
        }),
        // Fail closed: free store-sandbox purchases are never projected unless chosen.
        allowedEnvironment: read.optional("REVENUECAT_ALLOWED_ENVIRONMENT")
          ? read.enumValue("REVENUECAT_ALLOWED_ENVIRONMENT", ["PRODUCTION", "SANDBOX"])
          : "PRODUCTION",
        entitlementMap: parseEntitlementMap(
          requireEnabledValue(read, "REVENUECAT_ENTITLEMENT_MAP_JSON"),
        ),
      }
    : { enabled: false };

  return { polar, revenueCat };
}
