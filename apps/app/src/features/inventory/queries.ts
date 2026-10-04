import { infiniteQueryOptions, skipToken } from "@tanstack/react-query";
import {
  CATALOG_PAGE_SIZE,
  catalogInventoryQueryKeys,
  previousPageOfBusiness,
  type StockListFilters,
} from "../catalog/queries";
import { inventoryApi } from "./api";

export function stockInfiniteOptions(businessId: string | undefined, filters: StockListFilters) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          inventoryApi.listStock(
            {
              cursor: pageParam,
              limit: CATALOG_PAGE_SIZE,
              lowStockOnly: filters.lowStockOnly,
              search: filters.search || undefined,
            },
            signal,
          )
      : skipToken,
    queryKey: catalogInventoryQueryKeys.stock(businessId, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: previousPageOfBusiness(businessId),
  });
}

export function movementsInfiniteOptions(
  businessId: string | undefined,
  productId: string | undefined,
) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn:
      businessId && productId
        ? ({ pageParam, signal }) =>
            inventoryApi.listMovements(
              productId,
              { cursor: pageParam, limit: CATALOG_PAGE_SIZE },
              signal,
            )
        : skipToken,
    queryKey: catalogInventoryQueryKeys.movements(businessId, productId),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
