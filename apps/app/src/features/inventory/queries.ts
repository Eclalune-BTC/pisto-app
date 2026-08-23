import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  InventoryMovementListResponse,
  StockListResponse,
} from "../../../../../packages/contracts/src/catalog";

import { catalogInventoryQueryKeys } from "../catalog/query-keys";
import { inventoryApi } from "./api";

export function useStockQuery(input: {
  businessId: string | undefined;
  enabled: boolean;
  limit?: number;
  lowStockOnly: boolean;
  search: string;
}) {
  const search = input.search.trim();
  return useInfiniteQuery({
    enabled: input.enabled,
    getNextPageParam: (lastPage: StockListResponse["data"]) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<StockListResponse["data"]> =>
      inventoryApi.listStock({
        ...(pageParam ? { cursor: pageParam } : {}),
        ...(search ? { search } : {}),
        limit: input.limit ?? 25,
        lowStockOnly: input.lowStockOnly,
      }),
    queryKey: catalogInventoryQueryKeys.stock(input.businessId, {
      lowStockOnly: input.lowStockOnly,
      search,
    }),
  });
}

export function useMovementsQuery(input: {
  businessId: string | undefined;
  enabled: boolean;
  limit?: number;
  productId: string | undefined;
}) {
  return useInfiniteQuery({
    enabled: input.enabled && Boolean(input.productId),
    getNextPageParam: (lastPage: InventoryMovementListResponse["data"]) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<InventoryMovementListResponse["data"]> =>
      inventoryApi.listMovements(input.productId as string, {
        ...(pageParam ? { cursor: pageParam } : {}),
        limit: input.limit ?? 25,
      }),
    queryKey: catalogInventoryQueryKeys.movements(input.businessId, input.productId),
  });
}
