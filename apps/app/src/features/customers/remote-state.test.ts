import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { ApiClientError } from "@/lib/api-error";
import { hasDeniedRead, queryHasStaleData, readFailureKind } from "@/lib/query-state";
import { featureRemoteState } from "../cash/remote-state";

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
    expect(state?.status).toBe("error");
    const query = {
      data: state?.data,
      error: state?.error,
      fetchStatus: state?.fetchStatus ?? "idle",
      isError: state?.status === "error",
      isPending: false,
    };
    // Pending/offline companions cannot mask an authoritative rejection.
    const pending = { ...query, data: undefined, error: null, isError: false, isPending: true };
    expect(hasDeniedRead([pending, query])).toBe(true);
    expect(readFailureKind(error)).toBe("denied");
    expect(
      featureRemoteState({
        businessPending: false,
        canRead: true,
        queries: [pending, query],
        offlineMessage: "Offline",
        unavailableMessage: "Unavailable",
      }),
    ).toEqual({ kind: "denied" });
    client.clear();
  });

  test.each([0, 502, 503, 504])(
    "preserves labelled cached data after a transient HTTP %s failure",
    (status) => {
      const query = {
        data: { items: [] },
        error: new ApiClientError("Temporarily unavailable", status),
        fetchStatus: "idle" as const,
        isError: true,
        isPending: false,
      };
      expect(hasDeniedRead([query])).toBe(false);
      expect(queryHasStaleData(query)).toBe(true);
      expect(
        featureRemoteState({
          businessPending: false,
          canRead: true,
          queries: [query],
          offlineMessage: "Offline",
          unavailableMessage: "Unavailable",
        }),
      ).toEqual({ kind: "ready" });
    },
  );
});
