import type { TFunction } from "i18next";
import { ApiClientError } from "@/lib/api-error";

const translationKeys = {
  BUSINESS_REQUIRED: "productErrors.businessRequired",
  CONFLICT: "productErrors.conflict",
  FORBIDDEN: "productErrors.forbidden",
  IDEMPOTENCY_CONFLICT: "productErrors.idempotencyConflict",
  NOT_FOUND: "productErrors.notFound",
  UNAUTHORIZED: "productErrors.unauthorized",
  VALIDATION_ERROR: "productErrors.validation",
} as const;

export function productErrorMessage(error: unknown, fallback: string, t: TFunction): string {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.status === 0) return t("productErrors.connection");
  const key = translationKeys[error.code as keyof typeof translationKeys];
  return key ? t(key) : fallback;
}
