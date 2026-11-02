import { z } from "zod";

import {
  aggregateIntegerSchema,
  boundedListLimitSchema,
  calendarLocalDateSchema,
  currencyCodeSchema,
  currencyMinorUnitDigitsSchema,
  entrySourceSchema,
  localTimeSchema,
  minorUnitsSchema,
  opaqueCursorSchema,
  positiveMinorUnitsSchema,
  shortRequestTextSchema,
  timestampSchema,
  timeZoneSchema,
  uuidSchema,
} from "./primitives";

export * from "./assistant";
export * from "./cash";
export * from "./catalog";
export * from "./primitives";
export * from "./purchases";
export * from "./realtime";
export * from "./receivables";
export * from "./reports";

const requestIdSchema = z.string().min(1).max(128);

const apiErrorCodeSchema = z.enum([
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
  "RATE_LIMITED",
  "WRITES_PAUSED",
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
  timestamp: timestampSchema,
});

export const readinessResponseSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  service: z.literal("pisto-api"),
  timestamp: timestampSchema,
  checks: z.object({
    database: z.enum(["ok", "error"]),
    billing: z.enum(["enabled", "disabled"]),
  }),
});

const userSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string().email(),
  emailVerified: z.boolean(),
  image: z.string().url().nullable(),
});

const sessionSummarySchema = z.object({
  id: z.string().min(1),
  expiresAt: timestampSchema,
  activeOrganizationId: z.string().min(1).nullable(),
});

export const meResponseSchema = z.object({
  data: z.object({
    user: userSchema,
    session: sessionSummarySchema,
  }),
});

const billingStatusSchema = z.enum(["disabled", "enabled"]);

export const billingProductSlugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const billingCatalogProductSchema = z.object({
  slug: billingProductSlugSchema,
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

const billingScopeSchema = z.object({
  type: z.enum(["user", "organization"]),
  id: z.string().min(1),
});

const entitlementSchema = z.object({
  key: z.string().min(1),
  status: z.enum(["active", "inactive", "pending", "revoked", "expired", "unknown"]),
  source: z.enum(["polar", "revenuecat", "manual"]),
  productId: z.string().min(1).nullable(),
  validFrom: timestampSchema.nullable(),
  validUntil: timestampSchema.nullable(),
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
    slug: billingProductSlugSchema,
  })
  .strict();

export const billingPortalRequestSchema = z.object({}).strict();

export const billingRedirectResponseSchema = z.object({
  data: z.object({
    url: z.string().url(),
    redirect: z.literal(false),
  }),
});

const businessRoleSchema = z.enum(["owner", "admin", "member"]);

const businessPermissionSchema = z.enum([
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
  "purchases:read",
  "purchases:manage",
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
  createdAt: timestampSchema,
  access: businessAccessSchema,
});

export const businessesResponseSchema = z.object({
  data: z.object({
    activeBusinessId: z.string().min(1).nullable(),
    items: z.array(businessSchema),
  }),
});

/** What every business role may do, straight from the server's role policy. */
export const businessRolePoliciesResponseSchema = z.object({
  data: z.object({ roles: z.array(businessAccessSchema) }),
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

/** total_only records one amount; itemized records product lines, stock, payment and credit. */
export const saleEntryModeSchema = z.enum(["total_only", "itemized"]);

export const saleCorrectionKindSchema = z.enum(["void", "replacement"]);

const saleCorrectionReasonSchema = z.string().trim().min(2).max(240);

const saleCorrectionSchema = z.object({
  id: uuidSchema,
  kind: saleCorrectionKindSchema,
  reason: z.string().min(2).max(240),
  originalSaleId: uuidSchema,
  replacementSaleId: uuidSchema.nullable(),
  correctedAt: timestampSchema,
});

const saleSchema = z.object({
  id: uuidSchema,
  status: saleStatusSchema,
  entryMode: saleEntryModeSchema,
  grossMinorUnits: positiveMinorUnitsSchema,
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  occurredAt: timestampSchema,
  occurredLocalDate: calendarLocalDateSchema,
  occurredLocalTime: localTimeSchema,
  timeZone: timeZoneSchema,
  description: z.string().min(1).max(240).nullable(),
  correction: saleCorrectionSchema.nullable(),
  createdAt: timestampSchema,
});

export const createSaleRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    grossMinorUnits: positiveMinorUnitsSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    description: shortRequestTextSchema.optional(),
  })
  .strict();

export const saleResponseSchema = z.object({
  data: z.object({
    sale: saleSchema,
    replayed: z.boolean(),
  }),
});

export const saleReviewSchema = z
  .object({
    id: uuidSchema,
    businessId: z.string().min(1),
    command: createSaleRequestSchema,
    currency: currencyCodeSchema,
    currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
    timeZone: timeZoneSchema,
    createdAt: timestampSchema,
    saleId: uuidSchema.nullable(),
  })
  .strict()
  .refine((review) => review.id === review.command.idempotencyKey, {
    message: "The review must preserve the confirmation key",
  });

export const saleReviewResponseSchema = z
  .object({
    data: z.object({ review: saleReviewSchema.nullable() }).strict(),
  })
  .strict();

export const saleReviewActionRequestSchema = z.object({}).strict();
export const saleReviewPreparedResponseSchema = saleReviewResponseSchema.extend({
  data: z.object({ review: saleReviewSchema }).strict(),
});
export const saleReviewDismissRequestSchema = z
  .object({ acknowledgedSaleId: uuidSchema.nullable() })
  .strict();

export const saleReviewDismissResponseSchema = z
  .object({
    data: z.object({ saleId: uuidSchema.nullable() }).strict(),
  })
  .strict();

export const voidSaleRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    reason: saleCorrectionReasonSchema,
  })
  .strict();

const replacementSaleDraftSchema = createSaleRequestSchema.omit({ idempotencyKey: true });

export const replaceSaleRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    reason: saleCorrectionReasonSchema,
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

export const salePaymentMethodSchema = z.enum(["cash", "transfer", "card"]);

const itemizedSaleLineRequestSchema = z
  .object({
    productId: uuidSchema,
    /** Scaled by the product quantityPrecision, like inventory movements. */
    quantityMinorUnits: positiveMinorUnitsSchema,
    /** Omit to charge the product's current selling price. */
    unitPriceMinorUnits: minorUnitsSchema.optional(),
  })
  .strict();

/**
 * One counter sale: product lines leave stock, `payment` enters one cash account, and any balance
 * becomes a receivable for `customerId` due on `dueDate`. The server computes every amount.
 */
export const createItemizedSaleRequestSchema = z
  .object({
    idempotencyKey: uuidSchema,
    occurredLocalDate: calendarLocalDateSchema,
    occurredLocalTime: localTimeSchema,
    description: shortRequestTextSchema.optional(),
    customerId: uuidSchema.optional(),
    lines: z.array(itemizedSaleLineRequestSchema).min(1).max(50),
    payment: z
      .object({
        method: salePaymentMethodSchema,
        accountId: uuidSchema,
        receivedMinorUnits: positiveMinorUnitsSchema,
      })
      .strict()
      .optional(),
    dueDate: calendarLocalDateSchema.optional(),
    entrySource: entrySourceSchema.default("manual"),
  })
  .strict();

export const saleLineSchema = z.object({
  id: uuidSchema,
  productId: uuidSchema,
  productName: z.string().min(1).max(120),
  quantityMinorUnits: positiveMinorUnitsSchema,
  quantityPrecision: z.number().int().min(0).max(3),
  unitPriceMinorUnits: minorUnitsSchema,
  subtotalMinorUnits: minorUnitsSchema,
});

export const saleSettlementSchema = z.object({
  customerId: uuidSchema.nullable(),
  customerName: z.string().min(1).max(120).nullable(),
  paymentMethod: salePaymentMethodSchema.nullable(),
  accountId: uuidSchema.nullable(),
  receivedMinorUnits: minorUnitsSchema,
  creditMinorUnits: minorUnitsSchema,
  receivableId: uuidSchema.nullable(),
  dueDate: calendarLocalDateSchema.nullable(),
});

export const itemizedSaleResponseSchema = z.object({
  data: z.object({
    sale: saleSchema,
    lines: z.array(saleLineSchema).min(1),
    settlement: saleSettlementSchema,
    replayed: z.boolean(),
  }),
});

/** Accounts a seller may choose for a payment, without balances. */
export const saleFormOptionsResponseSchema = z
  .object({
    data: z
      .object({
        accounts: z.array(
          z.object({
            id: uuidSchema,
            name: z.string().min(1).max(80),
            kind: z.enum(["cash", "bank", "mobile_money", "other"]),
          }),
        ),
      })
      .strict(),
  })
  .strict();

export const saleStatusFilterSchema = z.enum(["posted", "voided", "all"]);

export const saleListQuerySchema = z
  .object({
    cursor: opaqueCursorSchema.optional(),
    limit: boundedListLimitSchema,
    status: saleStatusFilterSchema.default("all"),
  })
  .strict();

export const saleListSchema = z
  .object({
    items: z.array(saleSchema),
    nextCursor: opaqueCursorSchema.nullable(),
    queriedAt: timestampSchema,
  })
  .strict();

export const saleListResponseSchema = z.object({ data: saleListSchema }).strict();

export const previousMonthSummarySchema = z.object({
  periodStartLocal: calendarLocalDateSchema,
  periodEndLocalExclusive: calendarLocalDateSchema,
  periodStartUtc: timestampSchema,
  periodEndUtcExclusive: timestampSchema,
  timeZone: timeZoneSchema,
  currency: currencyCodeSchema,
  currencyMinorUnitDigits: currencyMinorUnitDigitsSchema,
  grossMinorUnits: aggregateIntegerSchema,
  saleCount: aggregateIntegerSchema,
  averageMinorUnits: minorUnitsSchema.nullable(),
  queriedAt: timestampSchema,
});

export const previousMonthSummaryResponseSchema = z.object({
  data: z.object({ summary: previousMonthSummarySchema }),
});

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiErrorEnvelope = z.infer<typeof apiErrorEnvelopeSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
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
export type BusinessRolePoliciesResponse = z.infer<typeof businessRolePoliciesResponseSchema>;
export type CreateBusinessRequest = z.infer<typeof createBusinessRequestSchema>;
export type CreateBusinessResponse = z.infer<typeof createBusinessResponseSchema>;
export type Sale = z.infer<typeof saleSchema>;
export type CreateSaleRequest = z.infer<typeof createSaleRequestSchema>;
export type SaleResponse = z.infer<typeof saleResponseSchema>;
export type SaleReview = z.infer<typeof saleReviewSchema>;
export type SaleReviewResponse = z.infer<typeof saleReviewResponseSchema>;
export type SaleReviewDismissResponse = z.infer<typeof saleReviewDismissResponseSchema>;
export type SaleCorrection = z.infer<typeof saleCorrectionSchema>;
export type VoidSaleRequest = z.infer<typeof voidSaleRequestSchema>;
export type ReplaceSaleRequest = z.infer<typeof replaceSaleRequestSchema>;
export type SaleCorrectionResponse = z.infer<typeof saleCorrectionResponseSchema>;
export type SaleEntryMode = z.infer<typeof saleEntryModeSchema>;
export type SalePaymentMethod = z.infer<typeof salePaymentMethodSchema>;
export type CreateItemizedSaleRequest = z.input<typeof createItemizedSaleRequestSchema>;
export type SaleLine = z.infer<typeof saleLineSchema>;
export type SaleSettlement = z.infer<typeof saleSettlementSchema>;
export type ItemizedSaleResponse = z.infer<typeof itemizedSaleResponseSchema>;
export type SaleFormOptionsResponse = z.infer<typeof saleFormOptionsResponseSchema>;
export type SaleStatusFilter = z.infer<typeof saleStatusFilterSchema>;
export type SaleListQuery = z.input<typeof saleListQuerySchema>;
export type SaleList = z.infer<typeof saleListSchema>;
export type SaleListResponse = z.infer<typeof saleListResponseSchema>;
export type PreviousMonthSummary = z.infer<typeof previousMonthSummarySchema>;
export type PreviousMonthSummaryResponse = z.infer<typeof previousMonthSummaryResponseSchema>;
