import type { ApiErrorEnvelope } from "@pisto/contracts";
import type { ZodType } from "zod";

export type ResponseMode = "envelope" | "raw";

export function isApiFailure(payload: unknown): payload is ApiErrorEnvelope {
  return typeof payload === "object" && payload !== null && "error" in payload;
}

export function extractSuccessPayload<T>(payload: unknown, mode: ResponseMode): T {
  if (mode === "raw") {
    return payload as T;
  }

  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    throw new Error("The server returned an invalid success envelope.");
  }

  return payload.data as T;
}

export function parseSuccessPayload<TResponse, TResult>(
  schema: ZodType<TResponse>,
  payload: unknown,
  mode: ResponseMode,
): TResult {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("The server response does not match the shared API contract.");
  }

  return extractSuccessPayload<TResult>(parsed.data, mode);
}
