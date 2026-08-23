import type { CategoryListResponse, ProductListResponse } from "@pisto/contracts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";

import { catalogApi } from "./api";
import { type CatalogStatusFilter, catalogInventoryQueryKeys } from "./query-keys";

export function useCategoriesQuery(input: {
  businessId: string | undefined;
  enabled: boolean;
  limit?: number;
  search: string;
  status: CatalogStatusFilter;
}) {
  const search = input.search.trim();
  return useInfiniteQuery({
    enabled: input.enabled,
    getNextPageParam: (lastPage: CategoryListResponse["data"]) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<CategoryListResponse["data"]> =>
      catalogApi.categories.list({
        ...(pageParam ? { cursor: pageParam } : {}),
        ...(search ? { search } : {}),
        limit: input.limit ?? 25,
        status: input.status,
      }),
    queryKey: catalogInventoryQueryKeys.categories(input.businessId, {
      search,
      status: input.status,
    }),
  });
}

export function useProductsQuery(input: {
  businessId: string | undefined;
  categoryId: string | null;
  enabled: boolean;
  limit?: number;
  search: string;
  status: CatalogStatusFilter;
}) {
  const search = input.search.trim();
  return useInfiniteQuery({
    enabled: input.enabled,
    getNextPageParam: (lastPage: ProductListResponse["data"]) => lastPage.nextCursor,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }): Promise<ProductListResponse["data"]> =>
      catalogApi.products.list({
        ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        ...(pageParam ? { cursor: pageParam } : {}),
        ...(search ? { search } : {}),
        limit: input.limit ?? 25,
        status: input.status,
      }),
    queryKey: catalogInventoryQueryKeys.products(input.businessId, {
      categoryId: input.categoryId,
      search,
      status: input.status,
    }),
  });
}

export function useProductQuery(input: {
  businessId: string | undefined;
  enabled: boolean;
  productId: string | undefined;
}) {
  return useQuery({
    enabled: input.enabled && Boolean(input.productId),
    queryFn: () => catalogApi.products.get(input.productId as string),
    queryKey: catalogInventoryQueryKeys.product(input.businessId, input.productId),
  });
}
