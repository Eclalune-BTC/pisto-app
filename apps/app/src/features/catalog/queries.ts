import type { Category } from "@pisto/contracts";
import {
  infiniteQueryOptions,
  type QueryClient,
  queryOptions,
  skipToken,
  useInfiniteQuery,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { reportsQueryKeys } from "@/features/reports/queries";
import { catalogApi } from "./api";

export const CATALOG_PAGE_SIZE = 25;
/** The server's largest page; choice lists read every category through it. */
export const CATALOG_CHOICE_PAGE_SIZE = 50;

export type CatalogStatusFilter = "active" | "archived" | "all";

export type ProductListFilters = {
  categoryId: string | null;
  search: string;
  status: CatalogStatusFilter;
};

export type CategoryListFilters = { search: string; status: CatalogStatusFilter };

export type StockListFilters = { lowStockOnly: boolean; search: string };

/**
 * Every catalog and inventory read of one business sits under one root: a product, category or
 * movement command changes prices, names, balances and low-stock flags across all of them.
 */
export const catalogInventoryQueryKeys = {
  business: (businessId: string | undefined) => ["catalog-inventory", businessId] as const,
  // Choices read every page at the largest size; a list pages at its own. They never share pages.
  categories: (businessId: string | undefined, filters: CategoryListFilters, limit: number) =>
    [...catalogInventoryQueryKeys.business(businessId), "categories", filters, limit] as const,
  products: (businessId: string | undefined, filters: ProductListFilters) =>
    [...catalogInventoryQueryKeys.business(businessId), "products", "list", filters] as const,
  product: (businessId: string | undefined, productId: string | undefined) =>
    [...catalogInventoryQueryKeys.business(businessId), "products", "detail", productId] as const,
  stock: (businessId: string | undefined, filters: StockListFilters) =>
    [...catalogInventoryQueryKeys.business(businessId), "stock", filters] as const,
  movements: (businessId: string | undefined, productId: string | undefined) =>
    [...catalogInventoryQueryKeys.business(businessId), "movements", productId] as const,
} as const;

/** The report counts tracked and low-stock products, so it is refreshed with the catalog. */
export function invalidateCatalogInventory(client: QueryClient, businessId: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: catalogInventoryQueryKeys.business(businessId) }),
    client.invalidateQueries({ queryKey: reportsQueryKeys.all(businessId) }),
  ]);
}

/**
 * Keeps the previous results on screen while a new search or filter loads, but never across
 * businesses: another business's records must not stand in for this one's.
 */
export function previousPageOfBusiness<T>(businessId: string | undefined) {
  return (previous: T | undefined, previousQuery: { queryKey: readonly unknown[] } | undefined) =>
    businessId !== undefined && previousQuery?.queryKey[1] === businessId ? previous : undefined;
}

export function categoriesInfiniteOptions(
  businessId: string | undefined,
  filters: CategoryListFilters,
  limit = CATALOG_PAGE_SIZE,
) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          catalogApi.categories.list(
            {
              cursor: pageParam,
              limit,
              search: filters.search || undefined,
              status: filters.status,
            },
            signal,
          )
      : skipToken,
    queryKey: catalogInventoryQueryKeys.categories(businessId, filters, limit),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: previousPageOfBusiness(businessId),
  });
}

export function productsInfiniteOptions(
  businessId: string | undefined,
  filters: ProductListFilters,
) {
  return infiniteQueryOptions({
    initialPageParam: undefined as string | undefined,
    queryFn: businessId
      ? ({ pageParam, signal }) =>
          catalogApi.products.list(
            {
              categoryId: filters.categoryId ?? undefined,
              cursor: pageParam,
              limit: CATALOG_PAGE_SIZE,
              search: filters.search || undefined,
              status: filters.status,
            },
            signal,
          )
      : skipToken,
    queryKey: catalogInventoryQueryKeys.products(businessId, filters),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    placeholderData: previousPageOfBusiness(businessId),
  });
}

export function productQueryOptions(businessId: string | undefined, productId: string | undefined) {
  return queryOptions({
    queryFn:
      businessId && productId
        ? ({ signal }) => catalogApi.products.get(productId, signal)
        : skipToken,
    queryKey: catalogInventoryQueryKeys.product(businessId, productId),
  });
}

const allCategories: CategoryListFilters = { search: "", status: "all" };

/**
 * Every category of the business, active and archived, for pickers and for naming a product's
 * category. Categories are a short list, so the remaining pages are read right away instead of
 * leaving a choice or a product's category name out.
 */
export function useCategoryChoices(businessId: string | undefined) {
  const query = useInfiniteQuery(
    categoriesInfiniteOptions(businessId, allCategories, CATALOG_CHOICE_PAGE_SIZE),
  );
  const { fetchNextPage, hasNextPage, isError, isFetchingNextPage } = query;
  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [fetchNextPage, hasNextPage, isError, isFetchingNextPage]);
  return query;
}

export function flattenPages<T>(data: { pages: readonly { items: readonly T[] }[] } | undefined) {
  return data?.pages.flatMap(({ items }) => items) ?? [];
}

/** Choices are complete only after the last page; until then a missing name is still loading. */
export function categoryChoices(query: {
  data: { pages: readonly { items: readonly Category[] }[] } | undefined;
  hasNextPage: boolean;
}) {
  const items = flattenPages(query.data);
  return {
    complete: query.data !== undefined && !query.hasNextPage,
    items,
    names: new Map(items.map((category) => [category.id, category.name])),
  };
}
