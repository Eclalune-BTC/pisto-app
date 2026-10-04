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

import { apiRequest, parseRequestPayload, pathWithQuery } from "@/lib/api-client";

export const receivablesApi = {
  list: (query: ListReceivablesQuery, signal?: AbortSignal) =>
    apiRequest<ReceivablesResponse, ReceivablesResponse["data"]>(
      pathWithQuery("/v1/receivables", parseRequestPayload(listReceivablesQuerySchema, query)),
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
        body: parseRequestPayload(postReceivableRequestSchema, command),
        method: "POST",
      },
      receivableResponseSchema,
    ),
  void: (receivableId: string, command: VoidReceivableRequest) =>
    apiRequest<ReceivableResponse, ReceivableResponse["data"]>(
      `/v1/receivables/${encodeURIComponent(receivableId)}/void`,
      {
        authenticated: true,
        body: parseRequestPayload(voidReceivableRequestSchema, command),
        method: "POST",
      },
      receivableResponseSchema,
    ),
  applyPayment: (receivableId: string, command: ApplyReceivablePaymentRequest) =>
    apiRequest<ReceivablePaymentResponse, ReceivablePaymentResponse["data"]>(
      `/v1/receivables/${encodeURIComponent(receivableId)}/payments`,
      {
        authenticated: true,
        body: parseRequestPayload(applyReceivablePaymentRequestSchema, command),
        method: "POST",
      },
      receivablePaymentResponseSchema,
    ),
  reversePayment: (paymentId: string, command: ReverseReceivablePaymentRequest) =>
    apiRequest<ReceivablePaymentResponse, ReceivablePaymentResponse["data"]>(
      `/v1/receivable-payments/${encodeURIComponent(paymentId)}/reverse`,
      {
        authenticated: true,
        body: parseRequestPayload(reverseReceivablePaymentRequestSchema, command),
        method: "POST",
      },
      receivablePaymentResponseSchema,
    ),
} as const;
