import type { Sale } from "@pisto/contracts";
import { describe, expect, test } from "vitest";

import { type SalesHistoryState, salesHistoryState } from "./state";

const sale: Sale = {
  id: "5312a3e6-7c91-486a-9233-0cf4d9d3dcc7",
  status: "posted",
  entryMode: "total_only",
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

const base = {
  canCorrect: true,
  hasMore: false,
  items: [sale],
  loadingMore: false,
  queriedAt: "2026-08-22T20:30:05.000Z",
  stale: false,
};

describe("sale history state", () => {
  test("keeps a failed read distinct from a real empty history", () => {
    const failed = salesHistoryState({
      ...base,
      items: [],
      queriedAt: undefined,
      remote: { kind: "error", message: "The history could not be read" },
    });
    const empty = salesHistoryState({ ...base, items: [], remote: { kind: "ready" } });

    expect(failed).toEqual({ kind: "error", message: "The history could not be read" });
    expect("queriedAt" in failed).toBe(false);
    expect(empty).toEqual({ kind: "empty", queriedAt: base.queriedAt, stale: false });
  });

  test("never reports an unanswered page as ready", () => {
    const unanswered = salesHistoryState({
      ...base,
      queriedAt: undefined,
      remote: { kind: "ready" },
    });

    expect(unanswered).toEqual({ kind: "loading" });
  });

  test("passes a denied or offline read through without inventing rows", () => {
    const denied = salesHistoryState({ ...base, remote: { kind: "denied" } });
    const offline = salesHistoryState({
      ...base,
      remote: { kind: "offline", message: "No connection" },
    });

    expect(denied).toEqual({ kind: "denied" });
    expect(offline).toEqual({ kind: "offline", message: "No connection" });
  });

  test("withdraws correction while the page is stale but still shows the history", () => {
    const fresh = salesHistoryState({ ...base, remote: { kind: "ready" } }) as Extract<
      SalesHistoryState,
      { kind: "ready" }
    >;
    const stale = salesHistoryState({
      ...base,
      remote: { kind: "ready" },
      stale: true,
    }) as Extract<SalesHistoryState, { kind: "ready" }>;

    expect(fresh.canCorrect).toBe(true);
    expect(stale.canCorrect).toBe(false);
    expect(stale.items).toEqual([sale]);
    expect(stale.stale).toBe(true);
  });

  test("never offers correction to an actor without the permission", () => {
    const state = salesHistoryState({
      ...base,
      canCorrect: false,
      remote: { kind: "ready" },
    }) as Extract<SalesHistoryState, { kind: "ready" }>;

    expect(state.canCorrect).toBe(false);
  });

  test("carries the paging affordance from the answered page", () => {
    const state = salesHistoryState({
      ...base,
      hasMore: true,
      loadingMore: true,
      remote: { kind: "ready" },
    }) as Extract<SalesHistoryState, { kind: "ready" }>;

    expect(state.hasMore).toBe(true);
    expect(state.loadingMore).toBe(true);
  });
});
