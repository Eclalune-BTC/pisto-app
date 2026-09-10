import type {
  ApplyReceivablePaymentRequest,
  ListReceivablesQuery,
  PostReceivableRequest,
  ReceivableDetailResponse,
  ReceivablePaymentResponse,
  ReceivableResponse,
  ReceivablesResponse,
  ReceivablesSummaryResponse,
  ReverseReceivablePaymentRequest,
  VoidReceivableRequest,
} from "@pisto/contracts";
import {
  applyReceivablePaymentRequestSchema,
  listReceivablesQuerySchema,
  postReceivableRequestSchema,
  receivableDetailResponseSchema,
  receivablePaymentResponseSchema,
  receivableResponseSchema,
  receivablesResponseSchema,
  receivablesSummaryResponseSchema,
  reverseReceivablePaymentRequestSchema,
  voidReceivableRequestSchema,
} from "@pisto/contracts";
import { apiRequest } from "@/lib/api-client";

function encodeQuery(query: ListReceivablesQuery): string {
  const parsed = listReceivablesQuerySchema.parse(query);
  const params = new URLSearchParams();
  params.set("limit", String(parsed.limit));
  params.set("state", parsed.state);
  if (parsed.cursor) params.set("cursor", parsed.cursor);
  if (parsed.customerId) params.set("customerId", parsed.customerId);
  return params.toString();
}

export const receivablesApi = {
  list: (query: ListReceivablesQuery, signal?: AbortSignal) =>
    apiRequest<ReceivablesResponse, ReceivablesResponse["data"]>(
      `/v1/receivables?${encodeQuery(query)}`,
      { authenticated: true, signal },
      receivablesResponseSchema,
    ),
  summary: (signal?: AbortSignal) =>
    apiRequest<ReceivablesSummaryResponse, ReceivablesSummaryResponse["data"]>(
      "/v1/receivables/summary",
      { authenticated: true, signal },
      receivablesSummaryResponseSchema,
    ),
  get: (receivableId: string, signal?: AbortSignal) =>
    apiRequest<ReceivableDetailResponse, ReceivableDetailResponse["data"]>(
      `/v1/receivables/${encodeURIComponent(receivableId)}`,
      { authenticated: true, signal },
      receivableDetailResponseSchema,
    ),
  post: (command: PostReceivableRequest) =>
    apiRequest<ReceivableResponse, ReceivableResponse["data"]>(
      "/v1/receivables",
      {
        authenticated: true,
        body: postReceivableRequestSchema.parse(command),
        method: "POST",
      },
      receivableResponseSchema,
    ),
  void: (receivableId: string, command: VoidReceivableRequest) =>
    apiRequest<ReceivableResponse, ReceivableResponse["data"]>(
      `/v1/receivables/${encodeURIComponent(receivableId)}/void`,
      {
        authenticated: true,
        body: voidReceivableRequestSchema.parse(command),
        method: "POST",
      },
      receivableResponseSchema,
    ),
  applyPayment: (receivableId: string, command: ApplyReceivablePaymentRequest) =>
    apiRequest<ReceivablePaymentResponse, ReceivablePaymentResponse["data"]>(
      `/v1/receivables/${encodeURIComponent(receivableId)}/payments`,
      {
        authenticated: true,
        body: applyReceivablePaymentRequestSchema.parse(command),
        method: "POST",
      },
      receivablePaymentResponseSchema,
    ),
  reversePayment: (paymentId: string, command: ReverseReceivablePaymentRequest) =>
    apiRequest<ReceivablePaymentResponse, ReceivablePaymentResponse["data"]>(
      `/v1/receivable-payments/${encodeURIComponent(paymentId)}/reverse`,
      {
        authenticated: true,
        body: reverseReceivablePaymentRequestSchema.parse(command),
        method: "POST",
      },
      receivablePaymentResponseSchema,
    ),
} as const;
