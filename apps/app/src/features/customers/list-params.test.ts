import { describe, expect, test } from "vitest";

import { isPositiveAmount } from "./format";
import { customerListSearchParams, firstParam, parseCustomerListParams } from "./list-params";

describe("customer list filters in the URL", () => {
  test("restores the search and status a record was opened from", () => {
    expect(parseCustomerListParams({ q: "  Ana ", status: "archived" })).toEqual({
      query: "Ana",
      status: "archived",
    });
    expect(parseCustomerListParams({ q: ["Luis", "Ana"], status: ["all"] })).toEqual({
      query: "Luis",
      status: "all",
    });
  });

  test("falls back to the documented defaults for absent or unknown values", () => {
    expect(parseCustomerListParams({})).toEqual({ query: "", status: "active" });
    expect(parseCustomerListParams({ status: "deleted" })).toEqual({
      query: "",
      status: "active",
    });
    expect(firstParam(undefined)).toBeUndefined();
  });

  test("keeps the plain list URL canonical by omitting defaults", () => {
    expect(customerListSearchParams({ query: "", status: "active" })).toEqual({
      q: undefined,
      status: undefined,
    });
    expect(customerListSearchParams({ query: "Ana", status: "all" })).toEqual({
      q: "Ana",
      status: "all",
    });
  });
});

describe("money tones", () => {
  test("only an amount above zero is highlighted, never a zero balance", () => {
    expect(isPositiveAmount("0")).toBe(false);
    expect(isPositiveAmount("1")).toBe(true);
    expect(isPositiveAmount("9223372036854775807")).toBe(true);
  });
});
