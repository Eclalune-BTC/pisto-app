import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { ApiClientError } from "@/lib/api-error";
import { readFailureKind } from "@/lib/query-state";
import { type ReadQuery, readState } from "./read-state";

const ready = (data: unknown): ReadQuery => ({
  data,
  error: null,
  fetchStatus: "idle",
  isError: false,
  isPending: false,
});

describe("cached access rejection", () => {
  test.each([
    [401, "UNAUTHORIZED"],
    [403, "FORBIDDEN"],
    [403, "API_REQUEST_FAILED"],
  ] as const)("hides a warm query after HTTP %s / %s", async (status, code) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const queryKey = ["customers", "business-a", "list", { status: "active" }];
    const cached = { items: [{ name: "Previously authorized customer" }] };
    client.setQueryData(queryKey, cached);
    const error = new ApiClientError("Access rejected", status, code);
    await expect(
      client.fetchQuery({ queryKey, queryFn: async () => Promise.reject(error) }),
    ).rejects.toBe(error);
    const state = client.getQueryState(queryKey);
    expect(state?.data).toBe(cached);
    const query: ReadQuery = {
      data: state?.data,
      error: state?.error,
      fetchStatus: state?.fetchStatus ?? "idle",
      isError: state?.status === "error",
      isPending: false,
    };
    // Pending and offline companions cannot mask an authoritative rejection.
    const pending = { ...query, data: undefined, error: null, isError: false, isPending: true };
    const paused = { ...pending, fetchStatus: "paused" as const };
    expect(readFailureKind(error)).toBe("denied");
    expect(readState([pending, paused, query])).toEqual({ kind: "denied" });
    client.clear();
  });

  test.each([0, 502, 503, 504])(
    "preserves labelled cached data after a transient HTTP %s failure",
    (status) => {
      const query: ReadQuery = {
        ...ready({ items: [] }),
        error: new ApiClientError("Temporarily unavailable", status),
        isError: true,
      };
      expect(readState([query])).toEqual({ kind: "ready", stale: true });
      expect(readState([{ ...query, data: undefined }])).toEqual({ kind: "error" });
    },
  );
});

describe("combined reads", () => {
  test("reports a paused read without data as offline instead of loading forever", () => {
    const paused: ReadQuery = { ...ready(undefined), fetchStatus: "paused", isPending: true };
    expect(readState([ready({}), paused])).toEqual({ kind: "offline" });
  });

  test("distinguishes a missing record from a failed read and a missing response", () => {
    const notFound: ReadQuery = {
      ...ready(undefined),
      error: new ApiClientError("Missing", 404, "NOT_FOUND"),
      isError: true,
    };
    expect(readState([notFound])).toEqual({ kind: "notFound" });
    expect(readState([ready(undefined)])).toEqual({ kind: "error" });
    expect(readState([{ ...ready(undefined), isPending: true }])).toEqual({ kind: "loading" });
    expect(readState([ready({}), ready({})])).toEqual({ kind: "ready", stale: false });
  });
});
