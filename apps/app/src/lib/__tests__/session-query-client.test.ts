import { MutationObserver, onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiClientError } from "../api-error";
import { createSessionQueryClient } from "../session-query-client";

afterEach(() => onlineManager.setOnline(true));

describe("session-owned queries and manual confirmations", () => {
  test("reports a failed session refresh without leaking errors or blocking the next attempt", async () => {
    const diagnostic = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const refresh = vi.fn(async () => {
      throw new Error("private provider details");
    });
    const scope = createSessionQueryClient(refresh);
    try {
      for (const key of ["first", "second"]) {
        await expect(
          scope.client.fetchQuery({
            queryKey: [key],
            queryFn: async () => {
              throw new ApiClientError("Expired", 401, "UNAUTHORIZED");
            },
          }),
        ).rejects.toMatchObject({ status: 401 });
        await vi.waitFor(() => expect(diagnostic).toHaveBeenCalledTimes(key === "first" ? 1 : 2));
      }
      expect(refresh).toHaveBeenCalledTimes(2);
      expect(diagnostic.mock.calls.flat().join(" ")).not.toContain("private provider details");
    } finally {
      scope.dispose();
      diagnostic.mockRestore();
    }
  });
  test("fails an offline confirmation without executing it later after unmount", async () => {
    const scope = createSessionQueryClient(async () => undefined);
    scope.client.mount();
    onlineManager.setOnline(false);
    const request = vi.fn(async (_command: { idempotencyKey: string }) => {
      throw new ApiClientError("Offline", 0);
    });
    const observer = new MutationObserver(scope.client, { mutationFn: request });
    const unsubscribe = observer.subscribe(() => undefined);
    const command = { idempotencyKey: "original-confirmation" };
    await expect(observer.mutate(command)).rejects.toMatchObject({ status: 0 });
    expect(observer.getCurrentResult()).toMatchObject({ isPaused: false, isError: true });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toEqual(command);
    unsubscribe();
    onlineManager.setOnline(true);
    await scope.client.resumePausedMutations();
    expect(request).toHaveBeenCalledTimes(1);
    scope.dispose();
    scope.client.unmount();
  });

  test("a new identity cannot reuse fresh account or business data", async () => {
    const first = createSessionQueryClient(async () => undefined);
    const second = createSessionQueryClient(async () => undefined);
    for (const key of [["businesses"], ["account", "me"], ["billing", "entitlements"]]) {
      first.client.setQueryData(key, { owner: "first" });
      expect(second.client.getQueryData(key)).toBeUndefined();
      expect(
        await second.client.fetchQuery({
          queryKey: key,
          queryFn: async () => ({ owner: "second" }),
        }),
      ).toEqual({ owner: "second" });
    }
    first.dispose();
    second.dispose();
  });

  test("ignores a late unauthorized mutation from a disposed identity", async () => {
    const refresh = vi.fn(async () => undefined);
    const scope = createSessionQueryClient(refresh);
    let reject!: (error: unknown) => void;
    const observer = new MutationObserver(scope.client, {
      mutationFn: () =>
        new Promise((_, rejectRequest) => {
          reject = rejectRequest;
        }),
    });
    const result = observer.mutate(undefined);
    await vi.waitFor(() => expect(reject).toBeTypeOf("function"));
    scope.dispose();
    reject(new ApiClientError("Expired", 401, "UNAUTHORIZED"));
    await expect(result).rejects.toMatchObject({ status: 401 });
    expect(refresh).not.toHaveBeenCalled();
  });

  test("refreshes current authentication once when concurrent reads are rejected", async () => {
    let release!: () => void;
    const refresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const scope = createSessionQueryClient(refresh);
    await Promise.allSettled(
      ["businesses", "account"].map((key) =>
        scope.client.fetchQuery({
          queryKey: [key],
          queryFn: async () => {
            throw new ApiClientError("Expired", 401, "UNAUTHORIZED");
          },
        }),
      ),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    release();
    scope.dispose();
  });
});
