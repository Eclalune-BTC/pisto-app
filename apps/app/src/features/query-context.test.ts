import {
  InfiniteQueryObserver,
  QueryClient,
  QueryObserver,
  skipToken,
} from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

const request = vi.hoisted(() => vi.fn(async (_path: string) => ({ items: [], nextCursor: null })));
vi.mock("@/lib/api-client", () => ({
  apiRequest: request,
  api: {
    sales: { get: request, list: request, previousMonthSummary: request, review: { get: request } },
  },
}));

import {
  cashAccountQueryOptions,
  cashAccountsInfiniteOptions,
  expenseQueryOptions,
  expenseSummaryQueryOptions,
} from "./cash/queries";
import { customerDetailQueryOptions, customersQueryOptions } from "./customers/queries";
import { cashAccountDetailQueryOptions } from "./receivables/cash-account-source";
import {
  receivableDetailQueryOptions,
  receivablesQueryOptions,
  receivablesSummaryQueryOptions,
} from "./receivables/queries";
import { operatingReportQueryOptions } from "./reports/queries";
import {
  previousMonthSummaryQueryOptions,
  saleQueryOptions,
  saleReviewQueryOptions,
} from "./sales/queries";

describe("required query context", () => {
  test("uses skipToken for absent business, record, customer filter or report dates", () => {
    const options = [
      cashAccountQueryOptions("business", undefined),
      cashAccountQueryOptions(undefined, "account"),
      cashAccountsInfiniteOptions(undefined, "active"),
      expenseQueryOptions("business", undefined),
      expenseSummaryQueryOptions("business", "", ""),
      customerDetailQueryOptions("business", undefined),
      customersQueryOptions(undefined, { status: "active" }),
      cashAccountDetailQueryOptions("business", undefined),
      receivableDetailQueryOptions(undefined, "receivable"),
      receivablesQueryOptions("business", undefined),
      receivablesSummaryQueryOptions(undefined),
      operatingReportQueryOptions("business", { startLocalDate: "", endLocalDate: "" }),
      saleQueryOptions("business", undefined),
      saleReviewQueryOptions(undefined),
      previousMonthSummaryQueryOptions(undefined),
    ];
    for (const option of options) expect(option.queryFn).toBe(skipToken);
  });

  test("a forced refetch without a record cannot send an HTTP request", async () => {
    request.mockClear();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const observer = new QueryObserver(client, cashAccountQueryOptions("business", undefined));
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const result = await observer.refetch();
      expect(result.isError).toBe(true);
      expect(result.data).toBeUndefined();
      expect(request).not.toHaveBeenCalled();
      observer.setOptions(cashAccountQueryOptions("business", "real-account"));
      expect((await observer.refetch()).isSuccess).toBe(true);
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0]?.[0]).toContain("real-account");
    } finally {
      diagnostic.mockRestore();
      client.clear();
    }
  });

  test("a missing customer filter cannot become an all-receivables read", async () => {
    request.mockClear();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const observer = new InfiniteQueryObserver(
      client,
      receivablesQueryOptions("business", undefined),
    );
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const result = await observer.refetch();
      expect(result.isError).toBe(true);
      expect(request).not.toHaveBeenCalled();
      observer.setOptions(
        receivablesQueryOptions("business", {
          customerId: "11111111-1111-4111-8111-111111111111",
          state: "all",
        }),
      );
      expect((await observer.refetch()).isSuccess).toBe(true);
      expect(request).toHaveBeenCalledTimes(1);
      expect(request.mock.calls[0]?.[0]).toContain(
        "customerId=11111111-1111-4111-8111-111111111111",
      );
    } finally {
      diagnostic.mockRestore();
      client.clear();
    }
  });
});
