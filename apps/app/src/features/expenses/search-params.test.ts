import { describe, expect, test } from "vitest";
import {
  defaultExpenseFilters,
  expenseFilterParams,
  expenseListFilters,
  expensePeriodParams,
  isValidExpensePeriod,
  parseExpenseSearch,
} from "./search-params";

const month = { startLocalDate: "2026-09-01", endLocalDate: "2026-09-27" };
const account = "11111111-1111-4111-8111-111111111111";

describe("expense route parameters", () => {
  test("restores history filters and the applied period from the route", () => {
    expect(
      parseExpenseSearch(
        {
          account,
          category: "rent",
          end: "2026-08-31",
          start: "2026-08-01",
          status: "voided",
        },
        month,
      ),
    ).toEqual({
      filters: { accountId: account, category: "rent", status: "voided" },
      period: { startLocalDate: "2026-08-01", endLocalDate: "2026-08-31" },
    });
  });

  test("falls back to each default for malformed or partial values", () => {
    expect(
      parseExpenseSearch(
        {
          account: "not-an-id",
          category: "lunch",
          start: "2026-09-30",
          end: "2026-09-01",
          status: "x",
        },
        month,
      ),
    ).toEqual({ filters: defaultExpenseFilters, period: month });
    expect(parseExpenseSearch({ start: "2026-08-01" }, month).period).toBe(month);
    expect(
      parseExpenseSearch({ start: ["2026-08-01", "x"], end: "2026-08-02" }, month).period,
    ).toEqual({ startLocalDate: "2026-08-01", endLocalDate: "2026-08-02" });
    expect(parseExpenseSearch({}, undefined).period).toBeUndefined();
  });

  test("keeps default values out of the URL", () => {
    expect(expenseFilterParams(defaultExpenseFilters)).toEqual({
      account: undefined,
      category: undefined,
      status: undefined,
    });
    expect(expenseFilterParams({ accountId: account, category: "tax", status: "all" })).toEqual({
      account,
      category: "tax",
      status: "all",
    });
    expect(expensePeriodParams(month, month)).toEqual({ end: undefined, start: undefined });
    expect(
      expensePeriodParams({ startLocalDate: "2026-08-01", endLocalDate: "2026-08-31" }, month),
    ).toEqual({ end: "2026-08-31", start: "2026-08-01" });
  });

  test("sends only real filters to the server", () => {
    expect(expenseListFilters(defaultExpenseFilters)).toEqual({ status: "posted" });
    expect(expenseListFilters({ accountId: account, category: "rent", status: "all" })).toEqual({
      accountId: account,
      category: "rent",
      status: "all",
    });
  });

  test("rejects impossible or reversed periods", () => {
    expect(isValidExpensePeriod(month)).toBe(true);
    expect(isValidExpensePeriod({ startLocalDate: "2026-02-30", endLocalDate: "2026-03-01" })).toBe(
      false,
    );
    expect(isValidExpensePeriod({ startLocalDate: "2026-09-02", endLocalDate: "2026-09-01" })).toBe(
      false,
    );
    expect(isValidExpensePeriod({ startLocalDate: "", endLocalDate: "2026-09-01" })).toBe(false);
  });
});
