import { z } from "zod";

export const apiVersion = "v1" as const;

export const requestIdSchema = z.string().min(1).max(128);

export const apiErrorCodeSchema = z.enum([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "VALIDATION_ERROR",
  "BILLING_DISABLED",
  "BILLING_UNAVAILABLE",
  "INTERNAL_ERROR",
  "SERVICE_UNAVAILABLE",
]);

export const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: apiErrorCodeSchema,
    message: z.string().min(1),
    requestId: requestIdSchema,
    details: z.unknown().optional(),
  }),
});

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("pisto-api"),
  timestamp: z.string().datetime({ offset: true }),
});

export const readinessResponseSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  service: z.literal("pisto-api"),
  timestamp: z.string().datetime({ offset: true }),
  checks: z.object({
    database: z.enum(["ok", "error"]),
    billing: z.enum(["enabled", "disabled"]),
  }),
});

export const apiRootResponseSchema = z.object({
  data: z.object({
    version: z.literal(apiVersion),
    service: z.literal("pisto-api"),
  }),
});

export const userSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().url().nullable(),
});

export const sessionSummarySchema = z.object({
  id: z.string().min(1),
  expiresAt: z.string().datetime({ offset: true }),
  activeOrganizationId: z.string().min(1).nullable(),
});

export const meResponseSchema = z.object({
  data: z.object({
    user: userSchema,
    session: sessionSummarySchema,
  }),
});

export const billingStatusSchema = z.enum(["disabled", "enabled"]);

export const billingCatalogProductSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
});

export const billingCatalogResponseSchema = z.object({
  data: z.object({
    status: billingStatusSchema,
    provider: z.literal("polar").nullable(),
    products: z.array(billingCatalogProductSchema),
  }),
});

export const billingScopeSchema = z.object({
  type: z.enum(["user", "organization"]),
  id: z.string().min(1),
});

export const entitlementSchema = z.object({
  key: z.string().min(1),
  status: z.enum(["active", "inactive", "pending", "revoked", "expired", "unknown"]),
  source: z.enum(["polar", "revenuecat", "manual"]),
  productId: z.string().min(1).nullable(),
  validFrom: z.string().datetime({ offset: true }).nullable(),
  validUntil: z.string().datetime({ offset: true }).nullable(),
  metadata: z.record(z.string(), z.unknown()),
});

export const entitlementsResponseSchema = z.object({
  data: z.object({
    scope: billingScopeSchema,
    items: z.array(entitlementSchema),
  }),
});

export const billingStateResponseSchema = z.object({
  data: z.object({
    status: billingStatusSchema,
    provider: z.literal("polar").nullable(),
    scope: billingScopeSchema,
    customerState: z.unknown().nullable(),
    entitlements: z.array(entitlementSchema),
  }),
});

export const billingCheckoutRequestSchema = z
  .object({
    slug: billingCatalogProductSchema.shape.slug,
  })
  .strict();

export const billingPortalRequestSchema = z.object({}).strict();

export const billingRedirectResponseSchema = z.object({
  data: z.object({
    url: z.string().url(),
    redirect: z.literal(false),
  }),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type ReadinessResponse = z.infer<typeof readinessResponseSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
export type BillingCatalogProduct = z.infer<typeof billingCatalogProductSchema>;
export type BillingCatalogResponse = z.infer<typeof billingCatalogResponseSchema>;
export type BillingScope = z.infer<typeof billingScopeSchema>;
export type Entitlement = z.infer<typeof entitlementSchema>;
export type EntitlementsResponse = z.infer<typeof entitlementsResponseSchema>;
export type BillingStateResponse = z.infer<typeof billingStateResponseSchema>;
export type BillingCheckoutRequest = z.infer<typeof billingCheckoutRequestSchema>;
export type BillingRedirectResponse = z.infer<typeof billingRedirectResponseSchema>;
