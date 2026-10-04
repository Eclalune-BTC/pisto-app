import { QueryClient, skipToken } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";

const api = vi.hoisted(() => ({
  listCategories: vi.fn(async () => ({ items: [], nextCursor: null })),
  listProducts: vi.fn(async () => ({ items: [], nextCursor: null })),
  listStock: vi.fn(async () => ({ items: [], nextCursor: null })),
}));
vi.mock("react-native", async () => vi.importActual("react-native-web"));
vi.mock("@/lib/api-client", () => ({ api: {} }));
vi.mock("./api", () => ({
  catalogApi: {
    categories: { list: api.listCategories },
    products: { list: api.listProducts },
  },
}));
vi.mock("../inventory/api", () => ({ inventoryApi: { listStock: api.listStock } }));

import { reportsQueryKeys } from "@/features/reports/queries";
import { stockInfiniteOptions } from "../inventory/queries";
import {
  catalogInventoryQueryKeys,
  categoryChoices,
  flattenPages,
  invalidateCatalogInventory,
  previousPageOfBusiness,
  productQueryOptions,
  productsInfiniteOptions,
} from "./queries";

const filters = { categoryId: null, search: "café", status: "active" } as const;

beforeEach(() => vi.clearAllMocks());

describe("catalog and inventory query ownership", () => {
  test("isolates cached records by business and exact filters", () => {
    const first = catalogInventoryQueryKeys.products("business-a", filters);
    const second = catalogInventoryQueryKeys.products("business-b", filters);
    const archived = catalogInventoryQueryKeys.products("business-a", {
      ...filters,
      status: "archived",
    });

    expect(first).not.toEqual(second);
    expect(first).not.toEqual(archived);
    expect(first.slice(0, 2)).toEqual(catalogInventoryQueryKeys.business("business-a"));
    expect(catalogInventoryQueryKeys.movements("business-a", "product").slice(0, 2)).toEqual(
      catalogInventoryQueryKeys.business("business-a"),
    );
  });

  test("skips every read until the business and record are known", () => {
    expect(productsInfiniteOptions(undefined, filters).queryFn).toBe(skipToken);
    expect(productQueryOptions("business-a", undefined).queryFn).toBe(skipToken);
    expect(productQueryOptions(undefined, "product").queryFn).toBe(skipToken);
    expect(stockInfiniteOptions(undefined, { lowStockOnly: false, search: "" }).queryFn).toBe(
      skipToken,
    );
  });

  test("sends the server only the filters a person set, at the shared page size", async () => {
    const client = new QueryClient();
    await client.fetchInfiniteQuery(
      productsInfiniteOptions("business-a", { categoryId: null, search: "", status: "all" }),
    );
    expect(api.listProducts).toHaveBeenCalledWith(
      { categoryId: undefined, cursor: undefined, limit: 25, search: undefined, status: "all" },
      expect.any(AbortSignal),
    );
    await client.fetchInfiniteQuery(
      stockInfiniteOptions("business-a", { lowStockOnly: true, search: "café" }),
    );
    expect(api.listStock).toHaveBeenCalledWith(
      { cursor: undefined, limit: 25, lowStockOnly: true, search: "café" },
      expect.any(AbortSignal),
    );
    client.clear();
  });

  test("keeps previous results on screen only within the same business", () => {
    const keep = previousPageOfBusiness<string>("business-a");
    expect(keep("rows", { queryKey: ["catalog-inventory", "business-a", "products"] })).toBe(
      "rows",
    );
    expect(keep("rows", { queryKey: ["catalog-inventory", "business-b", "products"] })).toBe(
      undefined,
    );
    expect(previousPageOfBusiness<string>(undefined)("rows", undefined)).toBe(undefined);
  });

  test("refreshes catalog, inventory and the report after any command", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    await invalidateCatalogInventory(client, "business-a");
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: catalogInventoryQueryKeys.business("business-a"),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: reportsQueryKeys.all("business-a") });
    client.clear();
  });

  test("flattens only successful server pages and calls choices complete after the last one", () => {
    const category = {
      id: "category",
      name: "Bebidas",
      status: "active" as const,
      createdAt: "2026-09-26T12:00:00.000Z",
      updatedAt: "2026-09-26T12:00:00.000Z",
    };
    expect(flattenPages({ pages: [{ items: ["a", "b"] }, { items: ["c"] }] })).toEqual([
      "a",
      "b",
      "c",
    ]);
    expect(flattenPages(undefined)).toEqual([]);
    const partial = categoryChoices({
      data: { pages: [{ items: [category] }] },
      hasNextPage: true,
    });
    expect(partial.complete).toBe(false);
    expect(partial.names.get("category")).toBe("Bebidas");
    expect(categoryChoices({ data: undefined, hasNextPage: false }).complete).toBe(false);
    expect(
      categoryChoices({ data: { pages: [{ items: [category] }] }, hasNextPage: false }).complete,
    ).toBe(true);
  });
});
