import type {
  ArchiveSupplierRequest,
  CreatePurchaseRequest,
  CreateSupplierPaymentRequest,
  CreateSupplierRequest,
  ListPurchasesQuery,
  ListSuppliersQuery,
  PayablesSummaryResponse,
  PurchaseDetailResponse,
  PurchaseListResponse,
  PurchaseResponse,
  ReceivePurchaseRequest,
  SupplierDetailResponse,
  SupplierListResponse,
  SupplierPaymentResponse,
  SupplierResponse,
  UpdateSupplierRequest,
  VoidPurchaseRequest,
} from "@pisto/contracts";
import {
  archiveSupplierRequestSchema,
  createPurchaseRequestSchema,
  createSupplierPaymentRequestSchema,
  createSupplierRequestSchema,
  listPurchasesQuerySchema,
  listSuppliersQuerySchema,
  payablesSummaryResponseSchema,
  purchaseDetailResponseSchema,
  purchaseListResponseSchema,
  purchaseResponseSchema,
  receivePurchaseRequestSchema,
  supplierDetailResponseSchema,
  supplierListResponseSchema,
  supplierPaymentResponseSchema,
  supplierResponseSchema,
  updateSupplierRequestSchema,
  voidPurchaseRequestSchema,
} from "@pisto/contracts";

import { apiRequest, parseRequestPayload, pathWithQuery } from "@/lib/api-client";

const supplierPath = (supplierId: string): `/${string}` =>
  `/v1/suppliers/${encodeURIComponent(supplierId)}`;
const purchasePath = (purchaseId: string): `/${string}` =>
  `/v1/purchases/${encodeURIComponent(purchaseId)}`;

export const purchasesApi = {
  suppliers: {
    list: (query: ListSuppliersQuery, signal?: AbortSignal) =>
      apiRequest<SupplierListResponse, SupplierListResponse["data"]>(
        pathWithQuery("/v1/suppliers", parseRequestPayload(listSuppliersQuerySchema, query)),
        { authenticated: true, signal },
        supplierListResponseSchema,
      ),
    get: (supplierId: string, signal?: AbortSignal) =>
      apiRequest<SupplierDetailResponse, SupplierDetailResponse["data"]>(
        supplierPath(supplierId),
        { authenticated: true, signal },
        supplierDetailResponseSchema,
      ),
    create: (command: CreateSupplierRequest) =>
      apiRequest<SupplierResponse, SupplierResponse["data"]>(
        "/v1/suppliers",
        {
          authenticated: true,
          body: parseRequestPayload(createSupplierRequestSchema, command),
          method: "POST",
        },
        supplierResponseSchema,
      ),
    update: (supplierId: string, command: UpdateSupplierRequest) =>
      apiRequest<SupplierResponse, SupplierResponse["data"]>(
        supplierPath(supplierId),
        {
          authenticated: true,
          body: parseRequestPayload(updateSupplierRequestSchema, command),
          method: "PATCH",
        },
        supplierResponseSchema,
      ),
    archive: (supplierId: string, command: ArchiveSupplierRequest) =>
      apiRequest<SupplierResponse, SupplierResponse["data"]>(
        `${supplierPath(supplierId)}/archive`,
        {
          authenticated: true,
          body: parseRequestPayload(archiveSupplierRequestSchema, command),
          method: "POST",
        },
        supplierResponseSchema,
      ),
  },
  purchases: {
    list: (query: ListPurchasesQuery, signal?: AbortSignal) =>
      apiRequest<PurchaseListResponse, PurchaseListResponse["data"]>(
        pathWithQuery("/v1/purchases", parseRequestPayload(listPurchasesQuerySchema, query)),
        { authenticated: true, signal },
        purchaseListResponseSchema,
      ),
    get: (purchaseId: string, signal?: AbortSignal) =>
      apiRequest<PurchaseDetailResponse, PurchaseDetailResponse["data"]>(
        purchasePath(purchaseId),
        { authenticated: true, signal },
        purchaseDetailResponseSchema,
      ),
    create: (command: CreatePurchaseRequest) =>
      apiRequest<PurchaseResponse, PurchaseResponse["data"]>(
        "/v1/purchases",
        {
          authenticated: true,
          body: parseRequestPayload(createPurchaseRequestSchema, command),
          method: "POST",
        },
        purchaseResponseSchema,
      ),
    receive: (purchaseId: string, command: ReceivePurchaseRequest) =>
      apiRequest<PurchaseResponse, PurchaseResponse["data"]>(
        `${purchasePath(purchaseId)}/receive`,
        {
          authenticated: true,
          body: parseRequestPayload(receivePurchaseRequestSchema, command),
          method: "POST",
        },
        purchaseResponseSchema,
      ),
    void: (purchaseId: string, command: VoidPurchaseRequest) =>
      apiRequest<PurchaseResponse, PurchaseResponse["data"]>(
        `${purchasePath(purchaseId)}/void`,
        {
          authenticated: true,
          body: parseRequestPayload(voidPurchaseRequestSchema, command),
          method: "POST",
        },
        purchaseResponseSchema,
      ),
    pay: (purchaseId: string, command: CreateSupplierPaymentRequest) =>
      apiRequest<SupplierPaymentResponse, SupplierPaymentResponse["data"]>(
        `${purchasePath(purchaseId)}/payments`,
        {
          authenticated: true,
          body: parseRequestPayload(createSupplierPaymentRequestSchema, command),
          method: "POST",
        },
        supplierPaymentResponseSchema,
      ),
  },
  payablesSummary: (signal?: AbortSignal) =>
    apiRequest<PayablesSummaryResponse, PayablesSummaryResponse["data"]>(
      "/v1/payables/summary",
      { authenticated: true, signal },
      payablesSummaryResponseSchema,
    ),
} as const;
