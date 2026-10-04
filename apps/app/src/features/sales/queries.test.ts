import { QueryClient, skipToken } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  api: { sales: { get: vi.fn(), list: vi.fn(), previousMonthSummary: vi.fn(), review: {} } },
  apiRequest: vi.fn(),
}));

import { invalidateSaleReads, SALES_PAGE_SIZE, salesInfiniteOptions } from "./queries";

describe("sales queries", () => {
  test("a committed sale or correction refreshes every sales and report read of its business", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
    await invalidateSaleReads(client, "business");
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["sales", "business"],
      ["reports", "business"],
    ]);
  });

  test("pages the history with the server's cursor and skips it without a business", () => {
    expect(SALES_PAGE_SIZE).toBe(25);
    const options = salesInfiniteOptions("business", "voided");
    expect(options.queryKey).toEqual(["sales", "business", "list", "voided"]);
    expect(
      options.getNextPageParam(
        { items: [], nextCursor: "next", queriedAt: "x" },
        [],
        undefined,
        [],
      ),
    ).toBe("next");
    expect(
      options.getNextPageParam({ items: [], nextCursor: null, queriedAt: "x" }, [], undefined, []),
    ).toBeUndefined();
    expect(salesInfiniteOptions(undefined, "all").queryFn).toBe(skipToken);
  });
});
