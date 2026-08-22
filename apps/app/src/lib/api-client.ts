import {
  type ApiErrorCode,
  type BillingCatalogResponse,
  type BillingCheckoutRequest,
  type BillingRedirectResponse,
  type BillingStateResponse,
  billingCatalogResponseSchema,
  billingCheckoutRequestSchema,
  billingPortalRequestSchema,
  billingRedirectResponseSchema,
  billingStateResponseSchema,
  type EntitlementsResponse,
  entitlementsResponseSchema,
  type HealthResponse,
  healthResponseSchema,
  type MeResponse,
  meResponseSchema,
} from "@pisto/contracts";
import { Platform } from "react-native";
import type { ZodType } from "zod";
import { isApiFailure, parseSuccessPayload, type ResponseMode } from "@/lib/api-response";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  authenticated?: boolean;
  body?: unknown;
};

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

export async function apiRequest<TResponse, TResult>(
  path: `/${string}`,
  { authenticated = false, body, headers, ...init }: ApiRequestOptions = {},
  schema: ZodType<TResponse>,
  responseMode: ResponseMode = "envelope",
): Promise<TResult> {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  let credentials: RequestCredentials = "include";

  if (authenticated && Platform.OS !== "web") {
    const cookie = await authClient.getCookie();
    if (cookie) {
      requestHeaders.set("Cookie", cookie);
    }
    credentials = "omit";
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials,
    headers: requestHeaders,
  });

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status);
  }

  if (!response.ok || isApiFailure(payload)) {
    const failure = isApiFailure(payload) ? payload.error : undefined;
    throw new ApiClientError(
      failure?.message ?? "The request could not be completed.",
      response.status,
      failure?.code ?? "API_REQUEST_FAILED",
      failure?.requestId,
    );
  }

  try {
    return parseSuccessPayload<TResponse, TResult>(schema, payload, responseMode);
  } catch {
    throw new ApiClientError("The server returned an invalid response shape.", response.status);
  }
}

export const api = {
  health: () =>
    apiRequest<HealthResponse, HealthResponse>("/health", {}, healthResponseSchema, "raw"),
  me: () =>
    apiRequest<MeResponse, MeResponse["data"]>("/v1/me", { authenticated: true }, meResponseSchema),
  billing: {
    catalog: () =>
      apiRequest<BillingCatalogResponse, BillingCatalogResponse["data"]>(
        "/v1/billing/catalog",
        {},
        billingCatalogResponseSchema,
      ),
    entitlements: () =>
      apiRequest<EntitlementsResponse, EntitlementsResponse["data"]>(
        "/v1/billing/entitlements",
        { authenticated: true },
        entitlementsResponseSchema,
      ),
    state: () =>
      apiRequest<BillingStateResponse, BillingStateResponse["data"]>(
        "/v1/billing/state",
        { authenticated: true },
        billingStateResponseSchema,
      ),
    checkout: (slug: BillingCheckoutRequest["slug"]) =>
      apiRequest<BillingRedirectResponse, BillingRedirectResponse["data"]>(
        "/v1/billing/checkout",
        {
          authenticated: true,
          body: billingCheckoutRequestSchema.parse({ slug }),
          method: "POST",
        },
        billingRedirectResponseSchema,
      ),
    portal: () =>
      apiRequest<BillingRedirectResponse, BillingRedirectResponse["data"]>(
        "/v1/billing/portal",
        {
          authenticated: true,
          body: billingPortalRequestSchema.parse({}),
          method: "POST",
        },
        billingRedirectResponseSchema,
      ),
  },
} as const;
