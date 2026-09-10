import type {
  InventoryMovementListQuery,
  InventoryMovementListResponse,
  InventoryMutationResponse,
  RecordInventoryMovementRequest,
  ReverseInventoryMovementRequest,
  StockListQuery,
  StockListResponse,
} from "@pisto/contracts";
import {
  inventoryMovementListResponseSchema,
  inventoryMutationResponseSchema,
  recordInventoryMovementRequestSchema,
  reverseInventoryMovementRequestSchema,
  stockListResponseSchema,
} from "@pisto/contracts";
import { apiRequest } from "@/lib/api-client";

function queryString(query: Record<string, boolean | number | string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const inventoryApi = {
  listStock: (query: StockListQuery, signal?: AbortSignal) =>
    apiRequest<StockListResponse, StockListResponse["data"]>(
      `/v1/inventory/stock${queryString(query)}`,
      { authenticated: true, signal },
      stockListResponseSchema,
    ),
  listMovements: (productId: string, query: InventoryMovementListQuery, signal?: AbortSignal) =>
    apiRequest<InventoryMovementListResponse, InventoryMovementListResponse["data"]>(
      `/v1/inventory/products/${encodeURIComponent(productId)}/movements${queryString(query)}`,
      { authenticated: true, signal },
      inventoryMovementListResponseSchema,
    ),
  recordMovement: (productId: string, command: RecordInventoryMovementRequest) =>
    apiRequest<InventoryMutationResponse, InventoryMutationResponse["data"]>(
      `/v1/inventory/products/${encodeURIComponent(productId)}/movements`,
      {
        authenticated: true,
        body: recordInventoryMovementRequestSchema.parse(command),
        method: "POST",
      },
      inventoryMutationResponseSchema,
    ),
  reverseMovement: (movementId: string, command: ReverseInventoryMovementRequest) =>
    apiRequest<InventoryMutationResponse, InventoryMutationResponse["data"]>(
      `/v1/inventory/movements/${encodeURIComponent(movementId)}/reverse`,
      {
        authenticated: true,
        body: reverseInventoryMovementRequestSchema.parse(command),
        method: "POST",
      },
      inventoryMutationResponseSchema,
    ),
} as const;
