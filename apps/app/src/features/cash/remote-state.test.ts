import { describe, expect, test } from "vitest";

import { featureRemoteState, queryHasStaleData } from "./remote-state";

const messages = { offlineMessage: "sin conexión", unavailableMessage: "no disponible" };

function query(overrides: Partial<Parameters<typeof queryHasStaleData>[0]> = {}) {
  return {
    data: undefined as unknown,
    error: null as unknown,
    fetchStatus: "idle" as "fetching" | "paused" | "idle",
    isError: false,
    isPending: false,
    ...overrides,
  };
}

describe("feature remote state", () => {
  test("reports offline rather than spinning when a first read is paused", () => {
    // A query paused for connectivity reports isPending with no error, so a
    // pending check that runs first leaves the screen loading forever.
    const state = featureRemoteState({
      businessPending: false,
      canRead: true,
      queries: [query({ fetchStatus: "paused", isPending: true })],
      ...messages,
    });

    expect(state).toEqual({ kind: "offline", message: "sin conexión" });
  });

  test("still loads when a read is pending for a reason other than connectivity", () => {
    const state = featureRemoteState({
      businessPending: false,
      canRead: true,
      queries: [query({ fetchStatus: "fetching", isPending: true })],
      ...messages,
    });

    expect(state).toEqual({ kind: "loading" });
  });

  test("keeps a denied read denied even while offline", () => {
    const state = featureRemoteState({
      businessPending: false,
      canRead: false,
      queries: [query({ data: {}, fetchStatus: "paused" })],
      ...messages,
    });

    expect(state).toEqual({ kind: "denied" });
  });
});

describe("stale data", () => {
  test("treats cached data that could not be refreshed as stale", () => {
    // Offline with a warm cache still renders balances. They are as old as the
    // last successful read, so a money operation must not be confirmed against
    // them as though they were current.
    expect(queryHasStaleData(query({ data: {}, fetchStatus: "paused" }))).toBe(true);
    expect(queryHasStaleData(query({ data: {}, isError: true }))).toBe(true);
  });

  test("does not call a healthy or an empty read stale", () => {
    expect(queryHasStaleData(query({ data: {} }))).toBe(false);
    expect(queryHasStaleData(query({ fetchStatus: "paused" }))).toBe(false);
    expect(queryHasStaleData(query({ isError: true }))).toBe(false);
  });
});
