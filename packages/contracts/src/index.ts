import { z } from "zod";

import {
  aggregateIntegerSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  localDateSchema,
  localTimeSchema,
  minorUnitsSchema,
  positiveMinorUnitsSchema,
  timeZoneSchema,
} from "./primitives";

export * from "./primitives";

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
  "BUSINESS_REQUIRED",
  "IDEMPOTENCY_CONFLICT",
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

export const businessRoleSchema = z.enum(["owner", "admin", "member"]);

export const businessPermissionSchema = z.enum([
  "business:configure",
  "business:read",
  "sales:create",
  "sales:read",
  "sales:summary:read",
  "sales:correct",
  "catalog:read",
  "catalog:manage",
  "inventory:read",
  "inventory:manage",
  "expenses:read",
  "expenses:manage",
  "cash:read",
  "cash:manage",
  "customers:read",
  "customers:manage",
  "receivables:read",
  "receivables:manage",
  "reports:read",
  "assistant:use",
]);

export const businessAccessSchema = z.object({
  role: businessRoleSchema,
  permissions: z.array(businessPermissionSchema),
});

export const businessSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  timeZone: timeZoneSchema,
  createdAt: z.string().datetime({ offset: true }),
  access: businessAccessSchema,
});

export const businessesResponseSchema = z.object({
  data: z.object({
    activeBusinessId: z.string().min(1).nullable(),
    items: z.array(businessSchema),
  }),
});

export const createBusinessRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    currency: currencyCodeSchema,
    timeZone: timeZoneSchema,
  })
  .strict();

export const createBusinessResponseSchema = z.object({
  data: z.object({
    business: businessSchema,
    replayed: z.boolean(),
  }),
});

export const saleStatusSchema = z.enum(["posted", "voided"]);

export const saleCorrectionKindSchema = z.enum(["void", "replacement"]);

export const saleCorrectionSchema = z.object({
  id: z.string().uuid(),
  kind: saleCorrectionKindSchema,
  reason: z.string().min(2).max(240),
  originalSaleId: z.string().uuid(),
  replacementSaleId: z.string().uuid().nullable(),
  correctedAt: z.string().datetime({ offset: true }),
});

export const saleSchema = z.object({
  id: z.string().uuid(),
  status: saleStatusSchema,
  entryMode: z.literal("total_only"),
  grossMinorUnits: positiveMinorUnitsSchema,
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  occurredAt: z.string().datetime({ offset: true }),
  occurredLocalDate: localDateSchema,
  occurredLocalTime: localTimeSchema,
  timeZone: timeZoneSchema,
  description: z.string().min(1).max(240).nullable(),
  correction: saleCorrectionSchema.nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const createSaleRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    grossMinorUnits: positiveMinorUnitsSchema,
    occurredLocalDate: localDateSchema,
    occurredLocalTime: localTimeSchema,
    description: z.string().trim().min(1).max(240).optional(),
  })
  .strict();

export const saleResponseSchema = z.object({
  data: z.object({
    sale: saleSchema,
    replayed: z.boolean(),
  }),
});

export const voidSaleRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    reason: z.string().trim().min(2).max(240),
  })
  .strict();

const replacementSaleDraftSchema = createSaleRequestSchema.omit({ idempotencyKey: true });

export const replaceSaleRequestSchema = z
  .object({
    idempotencyKey: z.string().uuid(),
    reason: z.string().trim().min(2).max(240),
    replacement: replacementSaleDraftSchema,
  })
  .strict();

export const saleCorrectionResponseSchema = z.object({
  data: z.object({
    correction: saleCorrectionSchema,
    originalSale: saleSchema,
    replacementSale: saleSchema.nullable(),
    replayed: z.boolean(),
  }),
});

export const previousMonthSummarySchema = z.object({
  periodStartLocal: localDateSchema,
  periodEndLocalExclusive: localDateSchema,
  periodStartUtc: z.string().datetime({ offset: true }),
  periodEndUtcExclusive: z.string().datetime({ offset: true }),
  timeZone: timeZoneSchema,
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  grossMinorUnits: aggregateIntegerSchema,
  saleCount: aggregateIntegerSchema,
  averageMinorUnits: minorUnitsSchema.nullable(),
  queriedAt: z.string().datetime({ offset: true }),
});

export const previousMonthSummaryResponseSchema = z.object({
  data: z.object({ summary: previousMonthSummarySchema }),
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
export type BusinessRole = z.infer<typeof businessRoleSchema>;
export type BusinessPermission = z.infer<typeof businessPermissionSchema>;
export type BusinessAccess = z.infer<typeof businessAccessSchema>;
export type Business = z.infer<typeof businessSchema>;
export type BusinessesResponse = z.infer<typeof businessesResponseSchema>;
export type CreateBusinessRequest = z.infer<typeof createBusinessRequestSchema>;
export type CreateBusinessResponse = z.infer<typeof createBusinessResponseSchema>;
export type Sale = z.infer<typeof saleSchema>;
export type CreateSaleRequest = z.infer<typeof createSaleRequestSchema>;
export type SaleResponse = z.infer<typeof saleResponseSchema>;
export type SaleCorrectionKind = z.infer<typeof saleCorrectionKindSchema>;
export type SaleCorrection = z.infer<typeof saleCorrectionSchema>;
export type VoidSaleRequest = z.infer<typeof voidSaleRequestSchema>;
export type ReplaceSaleRequest = z.infer<typeof replaceSaleRequestSchema>;
export type SaleCorrectionResponse = z.infer<typeof saleCorrectionResponseSchema>;
export type PreviousMonthSummary = z.infer<typeof previousMonthSummarySchema>;
export type PreviousMonthSummaryResponse = z.infer<typeof previousMonthSummaryResponseSchema>;
