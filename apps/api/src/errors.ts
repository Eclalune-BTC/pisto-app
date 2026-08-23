import type { ApiErrorCode } from "@pisto/contracts";
import { ProductError, type ProductErrorCode } from "@pisto/db";

export class ApiError extends Error {
  override readonly name = "ApiError";

  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 500 | 503,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

// Every ProductErrorCode is also a public ApiErrorCode, so a domain failure keeps
// its own code and only gains a status. The `code: ApiErrorCode` annotation in
// normalizeError is what proves that subset relationship at compile time: adding
// a ProductErrorCode without a matching public code fails `tsc`, it does not
// silently fall through to INTERNAL_ERROR at runtime.
const productErrorStatuses: Record<ProductErrorCode, ApiError["status"]> = {
  BUSINESS_REQUIRED: 409,
  CONFLICT: 409,
  FORBIDDEN: 403,
  IDEMPOTENCY_CONFLICT: 409,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  VALIDATION_ERROR: 400,
};

/**
 * Translate a thrown value into the public error envelope at the single error
 * boundary. `unexpected` marks the values that carry no reviewed public
 * contract; the caller logs those by stable type only and reports
 * INTERNAL_ERROR.
 */
export function normalizeError(error: unknown): { apiError: ApiError; unexpected: boolean } {
  if (error instanceof ApiError) {
    return { apiError: error, unexpected: false };
  }
  if (error instanceof ProductError) {
    // The Record type makes tsc reject an unmapped ProductErrorCode, but a
    // ProductError can still be constructed from untyped JavaScript. Reading the
    // status as possibly-absent keeps an unknown code failing closed as a 500
    // rather than reaching context.json with an undefined status.
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
