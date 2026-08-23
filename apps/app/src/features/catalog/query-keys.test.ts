import { describe, expect, test } from "vitest";

import { catalogInventoryQueryKeys, flattenPages } from "./query-keys";

describe("catalog and inventory query ownership", () => {
  test("isolates cached records by business and exact filters", () => {
    const first = catalogInventoryQueryKeys.products("business-a", {
      categoryId: null,
      search: "café",
      status: "active",
    });
    const second = catalogInventoryQueryKeys.products("business-b", {
      categoryId: null,
      search: "café",
      status: "active",
    });
    const archived = catalogInventoryQueryKeys.products("business-a", {
      categoryId: null,
      search: "café",
      status: "archived",
    });

    expect(first).not.toEqual(second);
    expect(first).not.toEqual(archived);
    expect(first.slice(0, 3)).toEqual(["catalog-inventory", "business-a", "products"]);
  });

  test("flattens only successful server pages and preserves their order", () => {
    expect(flattenPages([{ items: ["a", "b"] }, { items: ["c"] }])).toEqual(["a", "b", "c"]);
    expect(flattenPages(undefined)).toEqual([]);
  });
});
