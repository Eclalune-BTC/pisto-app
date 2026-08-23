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
import { apiRequest } from "@/lib/api-client";

function encodeQuery(query: ListCustomersQuery): string {
  const parsed = listCustomersQuerySchema.parse(query);
  const params = new URLSearchParams();
  params.set("limit", String(parsed.limit));
  params.set("status", parsed.status);
  if (parsed.cursor) params.set("cursor", parsed.cursor);
  if (parsed.query) params.set("query", parsed.query);
  return params.toString();
}

export const customersApi = {
  list: (query: ListCustomersQuery) =>
    apiRequest<CustomersResponse, CustomersResponse["data"]>(
      `/v1/customers?${encodeQuery(query)}`,
      { authenticated: true },
      customersResponseSchema,
    ),
  get: (customerId: string) =>
    apiRequest<CustomerDetailResponse, CustomerDetailResponse["data"]>(
      `/v1/customers/${encodeURIComponent(customerId)}`,
      { authenticated: true },
      customerDetailResponseSchema,
    ),
  create: (command: CreateCustomerRequest) =>
    apiRequest<CustomerResponse, CustomerResponse["data"]>(
      "/v1/customers",
      {
        authenticated: true,
        body: createCustomerRequestSchema.parse(command),
        method: "POST",
      },
      customerResponseSchema,
    ),
  update: (customerId: string, command: UpdateCustomerRequest) =>
    apiRequest<CustomerResponse, CustomerResponse["data"]>(
      `/v1/customers/${encodeURIComponent(customerId)}/update`,
      {
        authenticated: true,
        body: updateCustomerRequestSchema.parse(command),
        method: "POST",
      },
      customerResponseSchema,
    ),
  archive: (customerId: string, command: ArchiveCustomerRequest) =>
    apiRequest<CustomerResponse, CustomerResponse["data"]>(
      `/v1/customers/${encodeURIComponent(customerId)}/archive`,
      {
        authenticated: true,
        body: archiveCustomerRequestSchema.parse(command),
        method: "POST",
      },
      customerResponseSchema,
    ),
} as const;
