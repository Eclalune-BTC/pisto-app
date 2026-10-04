import type {
  ArchiveCustomerRequest,
  CreateCustomerRequest,
  CustomerDetailResponse,
  CustomerResponse,
  CustomersResponse,
  ListCustomersQuery,
  UpdateCustomerRequest,
} from "@pisto/contracts";
import {
  archiveCustomerRequestSchema,
  createCustomerRequestSchema,
  customerDetailResponseSchema,
  customerResponseSchema,
  customersResponseSchema,
  listCustomersQuerySchema,
  updateCustomerRequestSchema,
} from "@pisto/contracts";

import { apiRequest, parseRequestPayload, pathWithQuery } from "@/lib/api-client";

export const customersApi = {
  list: (query: ListCustomersQuery, signal?: AbortSignal) =>
    apiRequest<CustomersResponse, CustomersResponse["data"]>(
      pathWithQuery("/v1/customers", parseRequestPayload(listCustomersQuerySchema, query)),
      { authenticated: true, signal },
      customersResponseSchema,
    ),
  get: (customerId: string, signal?: AbortSignal) =>
    apiRequest<CustomerDetailResponse, CustomerDetailResponse["data"]>(
      `/v1/customers/${encodeURIComponent(customerId)}`,
      { authenticated: true, signal },
      customerDetailResponseSchema,
    ),
  create: (command: CreateCustomerRequest) =>
    apiRequest<CustomerResponse, CustomerResponse["data"]>(
      "/v1/customers",
      {
        authenticated: true,
        body: parseRequestPayload(createCustomerRequestSchema, command),
        method: "POST",
      },
      customerResponseSchema,
    ),
  update: (customerId: string, command: UpdateCustomerRequest) =>
    apiRequest<CustomerResponse, CustomerResponse["data"]>(
      `/v1/customers/${encodeURIComponent(customerId)}/update`,
      {
        authenticated: true,
        body: parseRequestPayload(updateCustomerRequestSchema, command),
        method: "POST",
      },
      customerResponseSchema,
    ),
  archive: (customerId: string, command: ArchiveCustomerRequest) =>
    apiRequest<CustomerResponse, CustomerResponse["data"]>(
      `/v1/customers/${encodeURIComponent(customerId)}/archive`,
      {
        authenticated: true,
        body: parseRequestPayload(archiveCustomerRequestSchema, command),
        method: "POST",
      },
      customerResponseSchema,
    ),
} as const;
