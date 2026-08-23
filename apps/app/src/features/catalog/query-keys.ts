export type CatalogStatusFilter = "active" | "archived" | "all";

export const catalogInventoryQueryKeys = {
  root: ["catalog-inventory"] as const,
  categoriesRoot: (businessId: string | undefined) =>
    [...catalogInventoryQueryKeys.root, businessId, "categories"] as const,
  categories: (
    businessId: string | undefined,
    filters: { search: string; status: CatalogStatusFilter },
  ) => [...catalogInventoryQueryKeys.categoriesRoot(businessId), filters] as const,
  productsRoot: (businessId: string | undefined) =>
    [...catalogInventoryQueryKeys.root, businessId, "products"] as const,
  products: (
    businessId: string | undefined,
    filters: { categoryId: string | null; search: string; status: CatalogStatusFilter },
  ) => [...catalogInventoryQueryKeys.productsRoot(businessId), filters] as const,
  product: (businessId: string | undefined, productId: string | undefined) =>
    [...catalogInventoryQueryKeys.productsRoot(businessId), "detail", productId] as const,
  stockRoot: (businessId: string | undefined) =>
    [...catalogInventoryQueryKeys.root, businessId, "stock"] as const,
  stock: (businessId: string | undefined, filters: { lowStockOnly: boolean; search: string }) =>
    [...catalogInventoryQueryKeys.stockRoot(businessId), filters] as const,
  movementsRoot: (businessId: string | undefined, productId: string | undefined) =>
    [...catalogInventoryQueryKeys.root, businessId, "movements", productId] as const,
  movements: (businessId: string | undefined, productId: string | undefined) =>
    [...catalogInventoryQueryKeys.movementsRoot(businessId, productId), "pages"] as const,
} as const;

export function flattenPages<T>(pages: readonly { items: readonly T[] }[] | undefined): T[] {
  return pages?.flatMap(({ items }) => [...items]) ?? [];
}
