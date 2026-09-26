import {
  type BillingCatalogResponse,
  type BillingCheckoutRequest,
  type BillingRedirectResponse,
  type BillingStateResponse,
  type BusinessesResponse,
  billingCatalogResponseSchema,
  billingCheckoutRequestSchema,
  billingPortalRequestSchema,
  billingRedirectResponseSchema,
  billingStateResponseSchema,
  businessesResponseSchema,
  type CreateBusinessRequest,
  type CreateBusinessResponse,
  type CreateSaleRequest,
  createBusinessRequestSchema,
  createBusinessResponseSchema,
  createSaleRequestSchema,
  type EntitlementsResponse,
  entitlementsResponseSchema,
  type HealthResponse,
  healthResponseSchema,
  type MeResponse,
  meResponseSchema,
  type PreviousMonthSummaryResponse,
  previousMonthSummaryResponseSchema,
  type ReplaceSaleRequest,
  replaceSaleRequestSchema,
  type SaleCorrectionResponse,
  type SaleListQuery,
  type SaleListResponse,
  type SaleResponse,
  type SaleReviewDismissResponse,
  type SaleReviewResponse,
  saleCorrectionResponseSchema,
  saleListResponseSchema,
  saleResponseSchema,
  saleReviewDismissResponseSchema,
  saleReviewPreparedResponseSchema,
  saleReviewResponseSchema,
  type VoidSaleRequest,
  voidSaleRequestSchema,
} from "@pisto/contracts";
import axios from "axios";
import { Platform } from "react-native";
import type { ZodType } from "zod";
import { ApiClientError } from "@/lib/api-error";
import { isApiFailure, parseSuccessPayload, type ResponseMode } from "@/lib/api-response";
import { authClient } from "@/lib/auth-client";
import { env } from "@/lib/env";

type ApiRequestOptions = Pick<RequestInit, "method" | "signal" | "headers"> & {
  authenticated?: boolean;
  body?: unknown;
};

export { ApiClientError, isAmbiguousMutationError } from "@/lib/api-error";

const http = axios.create({
  baseURL: env.apiUrl,
  timeout: 30_000,
  responseType: "text",
  transformResponse: [(data: unknown) => data],
  validateStatus: () => true,
});

function pathWithQuery(path: `/${string}`, query: Record<string, unknown>): `/${string}` {
  const search = Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return search ? `${path}?${search}` : path;
}

function parseRequestPayload<T>(schema: ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiClientError("The request payload is invalid.", 400, "VALIDATION_ERROR");
  }
  return result.data;
}

export async function apiRequest<TResponse, TResult>(
  path: `/${string}`,
  { authenticated = false, body, headers, ...init }: ApiRequestOptions = {},
  schema: ZodType<TResponse>,
  responseMode: ResponseMode = "envelope",
): Promise<TResult> {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new ApiClientError("The API path is invalid.", 400, "VALIDATION_ERROR");
  }
  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json");
  }

  let withCredentials = true;

  if (authenticated && Platform.OS !== "web") {
    const cookie = await authClient.getCookie();
    if (cookie) {
      requestHeaders.set("Cookie", cookie);
    }
    withCredentials = false;
  }

  let response: { status: number; data: unknown };
  try {
    response = await http.request({
      url: path,
      method: init.method ?? "GET",
      signal: init.signal ?? undefined,
      data: body === undefined ? undefined : JSON.stringify(body),
      withCredentials,
      headers: Object.fromEntries(requestHeaders.entries()),
    });
  } catch (error) {
    if (axios.isCancel(error) && ["GET", "HEAD"].includes(init.method ?? "GET")) throw error;
    throw new ApiClientError("The API could not be reached.", 0);
  }

  let payload: unknown;

  try {
    payload = typeof response.data === "string" ? JSON.parse(response.data) : response.data;
  } catch {
    throw new ApiClientError("The server returned an unreadable response.", response.status);
  }

  if (response.status < 200 || response.status >= 300 || isApiFailure(payload)) {
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
  businesses: {
    list: () =>
      apiRequest<BusinessesResponse, BusinessesResponse["data"]>(
        "/v1/businesses",
        { authenticated: true },
        businessesResponseSchema,
      ),
    create: (command: CreateBusinessRequest) =>
      apiRequest<CreateBusinessResponse, CreateBusinessResponse["data"]>(
        "/v1/businesses",
        {
          authenticated: true,
          body: parseRequestPayload(createBusinessRequestSchema, command),
          method: "POST",
        },
        createBusinessResponseSchema,
      ),
  },
  sales: {
    review: {
      get: (signal?: AbortSignal) =>
        apiRequest<SaleReviewResponse, SaleReviewResponse["data"]>(
          "/v1/sales/review",
          { authenticated: true, signal },
          saleReviewResponseSchema,
        ),
      prepare: (command: CreateSaleRequest) =>
        apiRequest<SaleReviewResponse, SaleReviewResponse["data"]>(
          "/v1/sales/review",
          {
            authenticated: true,
            method: "POST",
            body: parseRequestPayload(createSaleRequestSchema, command),
          },
          saleReviewPreparedResponseSchema,
        ),
      confirm: (reviewId: string) =>
        apiRequest<SaleResponse, SaleResponse["data"]>(
          `/v1/sales/review/${encodeURIComponent(reviewId)}/confirm`,
          { authenticated: true, method: "POST", body: {} },
          saleResponseSchema,
        ),
      dismiss: (reviewId: string, acknowledgedSaleId: string | null) =>
        apiRequest<SaleReviewDismissResponse, SaleReviewDismissResponse["data"]>(
          `/v1/sales/review/${encodeURIComponent(reviewId)}/dismiss`,
          { authenticated: true, method: "POST", body: { acknowledgedSaleId } },
          saleReviewDismissResponseSchema,
        ),
    },
    create: (command: CreateSaleRequest) =>
      apiRequest<SaleResponse, SaleResponse["data"]>(
        "/v1/sales",
        {
          authenticated: true,
          body: parseRequestPayload(createSaleRequestSchema, command),
          method: "POST",
        },
        saleResponseSchema,
      ),
    get: (saleId: string, signal?: AbortSignal) =>
      apiRequest<SaleResponse, SaleResponse["data"]>(
        `/v1/sales/${encodeURIComponent(saleId)}`,
        { authenticated: true, signal },
        saleResponseSchema,
      ),
    list: (query: SaleListQuery = {}, signal?: AbortSignal) =>
      apiRequest<SaleListResponse, SaleListResponse["data"]>(
        pathWithQuery("/v1/sales", query),
        { authenticated: true, signal },
        saleListResponseSchema,
      ),
    void: (saleId: string, command: VoidSaleRequest) =>
      apiRequest<SaleCorrectionResponse, SaleCorrectionResponse["data"]>(
        `/v1/sales/${encodeURIComponent(saleId)}/void`,
        {
          authenticated: true,
          body: parseRequestPayload(voidSaleRequestSchema, command),
          method: "POST",
        },
        saleCorrectionResponseSchema,
      ),
    replace: (saleId: string, command: ReplaceSaleRequest) =>
      apiRequest<SaleCorrectionResponse, SaleCorrectionResponse["data"]>(
        `/v1/sales/${encodeURIComponent(saleId)}/replace`,
        {
          authenticated: true,
          body: parseRequestPayload(replaceSaleRequestSchema, command),
          method: "POST",
        },
        saleCorrectionResponseSchema,
      ),
    previousMonthSummary: (signal?: AbortSignal) =>
      apiRequest<PreviousMonthSummaryResponse, PreviousMonthSummaryResponse["data"]>(
        "/v1/sales/summary/previous-month",
        { authenticated: true, signal },
        previousMonthSummaryResponseSchema,
      ),
  },
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
          body: parseRequestPayload(billingCheckoutRequestSchema, { slug }),
          method: "POST",
        },
        billingRedirectResponseSchema,
      ),
    portal: () =>
      apiRequest<BillingRedirectResponse, BillingRedirectResponse["data"]>(
        "/v1/billing/portal",
        {
          authenticated: true,
          body: parseRequestPayload(billingPortalRequestSchema, {}),
          method: "POST",
        },
        billingRedirectResponseSchema,
      ),
  },
} as const;
