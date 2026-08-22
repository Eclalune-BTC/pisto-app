import type { ApiErrorCode } from "@pisto/contracts";

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
