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
import { apiRequest, parseRequestPayload, pathWithQuery } from "@/lib/api-client";

export const inventoryApi = {
  listStock: (query: StockListQuery, signal?: AbortSignal) =>
    apiRequest<StockListResponse, StockListResponse["data"]>(
      pathWithQuery("/v1/inventory/stock", query),
      { authenticated: true, signal },
      stockListResponseSchema,
    ),
  listMovements: (productId: string, query: InventoryMovementListQuery, signal?: AbortSignal) =>
    apiRequest<InventoryMovementListResponse, InventoryMovementListResponse["data"]>(
      pathWithQuery(`/v1/inventory/products/${encodeURIComponent(productId)}/movements`, query),
      { authenticated: true, signal },
      inventoryMovementListResponseSchema,
    ),
  recordMovement: (productId: string, command: RecordInventoryMovementRequest) =>
    apiRequest<InventoryMutationResponse, InventoryMutationResponse["data"]>(
      `/v1/inventory/products/${encodeURIComponent(productId)}/movements`,
      {
        authenticated: true,
        body: parseRequestPayload(recordInventoryMovementRequestSchema, command),
        method: "POST",
      },
      inventoryMutationResponseSchema,
    ),
  reverseMovement: (movementId: string, command: ReverseInventoryMovementRequest) =>
    apiRequest<InventoryMutationResponse, InventoryMutationResponse["data"]>(
      `/v1/inventory/movements/${encodeURIComponent(movementId)}/reverse`,
      {
        authenticated: true,
        body: parseRequestPayload(reverseInventoryMovementRequestSchema, command),
        method: "POST",
      },
      inventoryMutationResponseSchema,
    ),
} as const;
