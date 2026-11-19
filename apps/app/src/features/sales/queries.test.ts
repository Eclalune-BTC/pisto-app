import { QueryClient, skipToken } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";
import { api } from "@/lib/api-client";

vi.mock("@/lib/api-client", () => ({
  api: { sales: { get: vi.fn(), list: vi.fn(), previousMonthSummary: vi.fn(), review: {} } },
  apiRequest: vi.fn(),
}));

import {
  invalidateSaleReads,
  previousMonthSummaryQueryOptions,
  SALES_PAGE_SIZE,
  salesInfiniteOptions,
} from "./queries";

describe("sales queries", () => {
  test("caches the previous month only for the business authorized by the server", async () => {
    const client = new QueryClient();
    const response = {
      summary: {
        businessId: "shop-b",
        periodStartLocal: "2026-09-01",
        periodEndLocalExclusive: "2026-10-01",
        periodStartUtc: "2026-09-01T06:00:00.000Z",
        periodEndUtcExclusive: "2026-10-01T06:00:00.000Z",
        queriedAt: "2026-10-10T12:00:00.000Z",
        timeZone: "America/El_Salvador",
        currency: "USD",
        currencyMinorUnitDigits: 2,
        grossMinorUnits: "250",
        saleCount: "1",
        averageMinorUnits: "250",
      },
    };
    vi.mocked(api.sales.previousMonthSummary).mockResolvedValue(response);
    const shopA = previousMonthSummaryQueryOptions("shop-a");
    await expect(client.fetchQuery(shopA)).rejects.toMatchObject({ status: 403 });
    expect(client.getQueryData(shopA.queryKey)).toBeUndefined();
    await expect(client.fetchQuery(previousMonthSummaryQueryOptions("shop-b"))).resolves.toEqual(
      response,
    );
    client.clear();
  });

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
