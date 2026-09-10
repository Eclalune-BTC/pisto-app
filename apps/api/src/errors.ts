import { BillingProviderError, RevenueCatWebhookError } from "@pisto/billing";
import type { ApiErrorCode } from "@pisto/contracts";
import { ProductError, type ProductErrorCode } from "@pisto/db";

export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429 | 500 | 503,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

const productErrorStatuses: Record<ProductErrorCode, ApiError["status"]> = {
  BUSINESS_REQUIRED: 409,
  CONFLICT: 409,
  FORBIDDEN: 403,
  IDEMPOTENCY_CONFLICT: 409,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  VALIDATION_ERROR: 400,
};

const revenueCatWebhookCodes: Record<RevenueCatWebhookError["status"], ApiErrorCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  409: "CONFLICT",
  503: "BILLING_DISABLED",
};

/** Unknown failures expose INTERNAL_ERROR and are logged by type only. */
export function normalizeError(error: unknown): { apiError: ApiError; unexpected: boolean } {
  if (error instanceof ApiError) {
    return { apiError: error, unexpected: false };
  }
  if (error instanceof BillingProviderError) {
    return {
      apiError: new ApiError(503, "BILLING_UNAVAILABLE", error.message),
      unexpected: false,
    };
  }
  if (error instanceof RevenueCatWebhookError) {
    const code = revenueCatWebhookCodes[error.status];
    if (code !== undefined) {
      return { apiError: new ApiError(error.status, code, error.message), unexpected: false };
    }
  }
  if (error instanceof ProductError) {
    // Untyped callers can supply an unknown code; keep it on the 500 path.
    const status = productErrorStatuses[error.code] as ApiError["status"] | undefined;
    if (status !== undefined) {
      const code: ApiErrorCode = error.code;
      return { apiError: new ApiError(status, code, error.message), unexpected: false };
    }
  }
  return {
    apiError: new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred"),
    unexpected: true,
  };
}
