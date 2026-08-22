import type { ApiErrorCode } from "@pisto/contracts";

export class ApiClientError extends Error {
  readonly code: ApiErrorCode | "API_REQUEST_FAILED";
  readonly requestId?: string;
  readonly status: number;

  constructor(
    message: string,
    status: number,
    code: ApiErrorCode | "API_REQUEST_FAILED" = "API_REQUEST_FAILED",
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export function isAmbiguousMutationError(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.status === 0 || error.status >= 500 || (error.status >= 200 && error.status < 300))
  );
}
