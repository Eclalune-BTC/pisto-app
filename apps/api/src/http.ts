import type { Auth } from "@pisto/auth";
import { z } from "zod";

import { ApiError } from "./errors.ts";

type JsonBodyContext = {
  req: {
    json: () => Promise<unknown>;
    text: () => Promise<string>;
  };
};

export async function parseJsonBody(context: JsonBodyContext): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Request body must be valid JSON");
  }
}

export async function parseOptionalJsonBody(context: JsonBodyContext): Promise<unknown> {
  const rawBody = await context.req.text();
  if (!rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Request body must be valid JSON");
  }
}

/** Invalid fields return 400 VALIDATION_ERROR with flattened contract details. */
export function parseRequest<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  message: string,
): z.output<Schema> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", message, parsed.error.flatten());
  }
  return parsed.data;
}

const recordIdSchema = z.string().uuid();

/** Malformed identifiers receive the same 404 response as undisclosed records. */
export function requireRecordId(value: string, notFoundMessage: string): string {
  const parsed = recordIdSchema.safeParse(value);
  if (!parsed.success) throw new ApiError(404, "NOT_FOUND", notFoundMessage);
  return parsed.data;
}

/** An exact idempotent replay is not a new resource, so it answers 200, not 201. */
export function commandStatus(result: { replayed: boolean }): 200 | 201 {
  return result.replayed ? 200 : 201;
}

function statusForAuthResponse(status: number): 400 | 401 | 403 | 500 | 503 {
  if (status === 400) return 400;
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status >= 500) return 503;
  return 500;
}

export async function callAuthEndpoint(input: {
  auth: Auth;
  baseUrl: string;
  path: string;
  method: "GET" | "POST";
  headers: Headers;
  body?: unknown;
}): Promise<unknown> {
  const headers = new Headers(input.headers);
  headers.delete("content-length");
  headers.set("accept", "application/json");
  if (input.body !== undefined) headers.set("content-type", "application/json");
  const response = await input.auth.handler(
    new Request(new URL(input.path, input.baseUrl), {
      method: input.method,
      headers,
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
    }),
  );
  if (!response.ok) {
    const status = statusForAuthResponse(response.status);
    throw new ApiError(
      status,
      status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BILLING_UNAVAILABLE",
      status === 401 || status === 403
        ? "Authentication is required for this billing operation"
        : "The billing provider request failed",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError(503, "BILLING_UNAVAILABLE", "The billing provider returned invalid JSON");
  }
}
