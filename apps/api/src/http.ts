import type { Auth } from "@pisto/auth";
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
  const payload = await response.json().catch(() => null);
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
  return payload;
}
