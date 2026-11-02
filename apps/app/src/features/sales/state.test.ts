import type { Sale, SaleList } from "@pisto/contracts";
import type { InfiniteData } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";
import { ApiClientError } from "@/lib/api-error";

import {
  canCorrectSale,
  parseSaleStatusFilter,
  readState,
  type SalesHistoryState,
  salesHistoryState,
} from "./state";

const sale: Sale = {
  id: "5312a3e6-7c91-486a-9233-0cf4d9d3dcc7",
  status: "posted",
  entryMode: "total_only",
  entrySource: "manual",
  customer: null,
  grossMinorUnits: "1250",
  currency: "USD",
  currencyMinorUnitDigits: 2,
  occurredAt: "2026-08-22T20:30:00.000Z",
  occurredLocalDate: "2026-08-22",
  occurredLocalTime: "14:30",
  timeZone: "America/El_Salvador",
  description: "Counter order",
  correction: null,
  createdAt: "2026-08-22T20:30:00.000Z",
};

const queriedAt = "2026-08-22T20:30:05.000Z";

function pages(...items: Sale[][]): InfiniteData<SaleList> {
  return {
    pageParams: items.map((_, index) => (index === 0 ? undefined : `cursor-${index}`)),
    pages: items.map((page, index) => ({
      items: page,
      nextCursor: null,
      queriedAt: index === 0 ? queriedAt : "2026-08-22T20:31:00.000Z",
    })),
  };
}

function query(overrides: Partial<Parameters<typeof salesHistoryState>[0]["query"]> = {}) {
  return {
    data: pages([sale]),
    error: null,
    fetchStatus: "idle" as const,
    hasNextPage: false,
    isError: false,
    isFetchingNextPage: false,
    ...overrides,
  };
}

const base = { accessStale: false, canCorrect: true, canRead: true };

describe("sale history state", () => {
  test("keeps a failed read distinct from a real empty history", () => {
    const failed = salesHistoryState({
      ...base,
      query: query({ data: undefined, error: new ApiClientError("Down", 503), isError: true }),
    });
    const empty = salesHistoryState({ ...base, query: query({ data: pages([]) }) });

    expect(failed).toEqual({ kind: "error" });
    expect("queriedAt" in failed).toBe(false);
    expect(empty).toEqual({ kind: "empty", queriedAt, stale: false });
  });

  test("never reports an unanswered page as ready", () => {
    expect(salesHistoryState({ ...base, query: query({ data: undefined }) })).toEqual({
      kind: "loading",
    });
  });

  test("tells a paused first read apart from loading", () => {
    expect(
      salesHistoryState({ ...base, query: query({ data: undefined, fetchStatus: "paused" }) }),
    ).toEqual({ kind: "offline" });
  });

  test("lets an access rejection override cached rows", () => {
    const denied = salesHistoryState({
      ...base,
      query: query({ error: new ApiClientError("Forbidden", 403), isError: true }),
    });
    expect(denied).toEqual({ kind: "denied" });
    expect(salesHistoryState({ ...base, canRead: false, query: query() })).toEqual({
      kind: "denied",
    });
  });

  test("withdraws correction while the page or the access is stale but still shows the history", () => {
    const fresh = salesHistoryState({ ...base, query: query() }) as Extract<
      SalesHistoryState,
      { kind: "ready" }
    >;
    const staleRead = salesHistoryState({
      ...base,
      query: query({ error: new ApiClientError("Down", 503), isError: true }),
    }) as Extract<SalesHistoryState, { kind: "ready" }>;
    const staleAccess = salesHistoryState({
      ...base,
      accessStale: true,
      query: query(),
    }) as Extract<SalesHistoryState, { kind: "ready" }>;

    expect(fresh.canCorrect).toBe(true);
    expect(staleRead).toMatchObject({ canCorrect: false, items: [sale], stale: true });
    expect(staleAccess).toMatchObject({ canCorrect: false, items: [sale], stale: true });
  });

  test("never offers correction to an actor without the permission", () => {
    const state = salesHistoryState({ ...base, canCorrect: false, query: query() });
    expect(state).toMatchObject({ kind: "ready", canCorrect: false });
  });

  test("joins answered pages and claims the freshness of the oldest one", () => {
    const second = { ...sale, id: "6312a3e6-7c91-486a-9233-0cf4d9d3dcc7" };
    const state = salesHistoryState({
      ...base,
      query: query({ data: pages([sale], [second]), hasNextPage: true, isFetchingNextPage: true }),
    });
    expect(state).toEqual({
      kind: "ready",
      canCorrect: true,
      hasMore: true,
      items: [sale, second],
      loadingMore: true,
      queriedAt,
      stale: false,
    });
  });
});

describe("route read state", () => {
  const ready = { data: {}, error: null, fetchStatus: "idle" as const, isError: false };
  test("ranks denial, failure, offline and loading before readiness", () => {
    expect(readState([ready, { ...ready, error: new ApiClientError("No", 401) }])).toBe("denied");
    expect(readState([ready, { ...ready, data: undefined, isError: true, error: {} }])).toBe(
      "error",
    );
    expect(
      readState([{ ...ready, data: undefined, isError: true, error: {}, fetchStatus: "paused" }]),
    ).toBe("offline");
    expect(readState([{ ...ready, data: undefined, fetchStatus: "paused" }])).toBe("offline");
    expect(readState([ready, { ...ready, data: undefined }])).toBe("loading");
    expect(readState([ready, { ...ready, isError: true, error: {} }])).toBe("ready");
  });
});

describe("status filter from the URL", () => {
  test.each([
    [undefined, "all"],
    ["posted", "posted"],
    ["voided", "voided"],
    [["voided", "posted"], "voided"],
    ["deleted", "all"],
    ["", "all"],
  ] as const)("reads %j as %s", (value, expected) => {
    expect(parseSaleStatusFilter(value as string | string[] | undefined)).toBe(expected);
  });
});

describe("correction eligibility", () => {
  test("allows only a posted sale without a correction", () => {
    const correction = {
      id: "7312a3e6-7c91-486a-9233-0cf4d9d3dcc7",
      kind: "replacement" as const,
      reason: "Wrong total",
      originalSaleId: "8312a3e6-7c91-486a-9233-0cf4d9d3dcc7",
      replacementSaleId: sale.id,
      correctedAt: "2026-08-23T20:30:00.000Z",
    };
    expect(canCorrectSale(sale)).toBe(true);
    expect(canCorrectSale({ ...sale, status: "voided" })).toBe(false);
    expect(canCorrectSale({ ...sale, correction })).toBe(false);
  });
});
