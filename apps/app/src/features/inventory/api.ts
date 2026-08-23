import { apiRequest } from "@/lib/api-client";
import type {
  InventoryMovementListQuery,
  InventoryMovementListResponse,
  InventoryMutationResponse,
  RecordInventoryMovementRequest,
  ReverseInventoryMovementRequest,
  StockListQuery,
  StockListResponse,
} from "../../../../../packages/contracts/src/catalog";
import {
  inventoryMovementListResponseSchema,
  inventoryMutationResponseSchema,
  recordInventoryMovementRequestSchema,
  reverseInventoryMovementRequestSchema,
  stockListResponseSchema,
} from "../../../../../packages/contracts/src/catalog";

function queryString(query: Record<string, boolean | number | string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export const inventoryApi = {
  listStock: (query: StockListQuery) =>
    apiRequest<StockListResponse, StockListResponse["data"]>(
      `/v1/inventory/stock${queryString(query)}`,
      { authenticated: true },
      stockListResponseSchema,
    ),
  listMovements: (productId: string, query: InventoryMovementListQuery) =>
    apiRequest<InventoryMovementListResponse, InventoryMovementListResponse["data"]>(
      `/v1/inventory/products/${encodeURIComponent(productId)}/movements${queryString(query)}`,
      { authenticated: true },
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
