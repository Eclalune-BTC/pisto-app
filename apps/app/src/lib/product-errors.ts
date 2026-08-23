import type { ParseKeys, TFunction } from "i18next";
import { ApiClientError, isAmbiguousMutationError } from "@/lib/api-error";

type ProductErrorCode = keyof typeof translationKeys;

/**
 * Operations whose reason codes deserve a more specific sentence than the flat
 * table. A context only overrides the codes it can describe more precisely.
 */
export type ProductErrorContext =
  | "archiveProduct"
  | "business"
  | "category"
  | "movement"
  | "product"
  | "reversal"
  | "sale";

const translationKeys = {
  BUSINESS_REQUIRED: "productErrors.businessRequired",
  CONFLICT: "productErrors.conflict",
  FORBIDDEN: "productErrors.forbidden",
  IDEMPOTENCY_CONFLICT: "productErrors.idempotencyConflict",
  NOT_FOUND: "productErrors.notFound",
  UNAUTHORIZED: "productErrors.unauthorized",
  VALIDATION_ERROR: "productErrors.validation",
} as const;

const contextTranslationKeys: Record<
  ProductErrorContext,
  Partial<Record<ProductErrorCode, ParseKeys>>
> = {
  archiveProduct: {
    CONFLICT: "productErrors.contexts.archiveProduct.conflict",
    FORBIDDEN: "productErrors.contexts.archiveProduct.forbidden",
    IDEMPOTENCY_CONFLICT: "productErrors.contexts.archiveProduct.idempotency",
    NOT_FOUND: "productErrors.contexts.archiveProduct.notFound",
    VALIDATION_ERROR: "productErrors.contexts.archiveProduct.validation",
  },
  business: {
    CONFLICT: "productErrors.contexts.business.conflict",
  },
  category: {
    CONFLICT: "productErrors.contexts.category.conflict",
    FORBIDDEN: "productErrors.contexts.category.forbidden",
    IDEMPOTENCY_CONFLICT: "productErrors.contexts.category.idempotency",
    NOT_FOUND: "productErrors.contexts.category.notFound",
    VALIDATION_ERROR: "productErrors.contexts.category.validation",
  },
  movement: {
    CONFLICT: "productErrors.contexts.movement.conflict",
    FORBIDDEN: "productErrors.contexts.movement.forbidden",
    IDEMPOTENCY_CONFLICT: "productErrors.contexts.movement.idempotency",
    NOT_FOUND: "productErrors.contexts.movement.notFound",
    VALIDATION_ERROR: "productErrors.contexts.movement.validation",
  },
  product: {
    CONFLICT: "productErrors.contexts.product.conflict",
    FORBIDDEN: "productErrors.contexts.product.forbidden",
    IDEMPOTENCY_CONFLICT: "productErrors.contexts.product.idempotency",
    NOT_FOUND: "productErrors.contexts.product.notFound",
    VALIDATION_ERROR: "productErrors.contexts.product.validation",
  },
  reversal: {
    CONFLICT: "productErrors.contexts.reversal.conflict",
    FORBIDDEN: "productErrors.contexts.reversal.forbidden",
    IDEMPOTENCY_CONFLICT: "productErrors.contexts.reversal.idempotency",
    NOT_FOUND: "productErrors.contexts.reversal.notFound",
    VALIDATION_ERROR: "productErrors.contexts.reversal.validation",
  },
  sale: {
    IDEMPOTENCY_CONFLICT: "productErrors.contexts.sale.idempotency",
  },
};

export function productErrorMessage(
  error: unknown,
  fallback: string,
  t: TFunction,
  context?: ProductErrorContext,
): string {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.status === 0) return t("productErrors.connection");
  if (isAmbiguousMutationError(error)) return t("productErrors.ambiguous");
  const code = error.code as ProductErrorCode;
  const contextKey = context ? contextTranslationKeys[context][code] : undefined;
  if (contextKey) return t(contextKey);
  const key = translationKeys[code];
  return key ? t(key) : fallback;
}
