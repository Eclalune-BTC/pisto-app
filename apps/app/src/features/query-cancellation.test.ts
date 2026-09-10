import { InfiniteQueryObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requests = vi.hoisted(
  () =>
    [] as {
      path: string;
      method?: string;
      signal?: AbortSignal;
      resolve: (value: unknown) => void;
    }[],
);

vi.mock("@/lib/api-client", () => ({
  apiRequest: (path: string, options: { method?: string; signal?: AbortSignal }) =>
    new Promise((resolve, reject) => {
      requests.push({ path, ...options, resolve });
      options.signal?.addEventListener("abort", () => reject(new Error("Request canceled")), {
        once: true,
      });
    }),
}));

import { cashAccountsInfiniteOptions } from "./cash/queries";
import { customersApi } from "./customers/api";
import { customersQueryOptions } from "./customers/queries";
import { operatingReportQueryOptions } from "./reports/queries";

let client: QueryClient;
beforeEach(() => {
  requests.length = 0;
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

describe("read request cancellation", () => {
  test("aborts an obsolete search and lets the current result settle without an error", async () => {
    const previous = customersQueryOptions("business-a", { query: "Maria", status: "active" });
    const current = customersQueryOptions("business-a", { query: "Jose", status: "active" });
    const observer = new InfiniteQueryObserver(client, previous);
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    const previousRequest = requests[0];
    expect(previousRequest?.signal?.aborted).toBe(false);

    observer.setOptions(current);
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(previousRequest?.signal?.aborted).toBe(true);
    expect(requests[1]?.path).toContain("query=Jose");
    expect(requests[1]?.path).not.toContain("signal");
    expect(requests[1]?.signal?.aborted).toBe(false);
    requests[1]?.resolve({ items: [], nextCursor: null });
    await vi.waitFor(() => expect(observer.getCurrentResult().isSuccess).toBe(true));
    expect(observer.getCurrentResult().error).toBeNull();
    expect(client.getQueryState(previous.queryKey)).toMatchObject({
      data: undefined,
      error: null,
      fetchStatus: "idle",
    });
    unsubscribe();
  });

  test("keeps a shared account request alive until its last observer leaves", async () => {
    const options = cashAccountsInfiniteOptions("business-a", "active");
    const first = new InfiniteQueryObserver(client, options);
    const second = new InfiniteQueryObserver(client, options);
    const unsubscribeFirst = first.subscribe(() => undefined);
    const unsubscribeSecond = second.subscribe(() => undefined);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    const sharedRequest = requests[0];

    first.setOptions(cashAccountsInfiniteOptions("business-a", "archived"));
    await vi.waitFor(() => expect(requests).toHaveLength(2));
    expect(sharedRequest?.signal?.aborted).toBe(false);
    unsubscribeSecond();
    expect(sharedRequest?.signal?.aborted).toBe(true);
    expect(requests[1]?.signal?.aborted).toBe(false);
    unsubscribeFirst();
    expect(requests[1]?.signal?.aborted).toBe(true);
  });

  test("aborts an obsolete report period at the same transport boundary", async () => {
    const options = operatingReportQueryOptions("business-a", {
      startLocalDate: "2026-09-01",
      endLocalDate: "2026-09-10",
    });
    const observer = new QueryObserver(client, options);
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0]?.signal?.aborted).toBe(false);
    unsubscribe();
    expect(requests[0]?.signal?.aborted).toBe(true);
    expect(client.getQueryState(options.queryKey)?.error).toBeNull();
  });

  test("does not attach query cancellation to a pending save", async () => {
    const observer = new InfiniteQueryObserver(
      client,
      customersQueryOptions("business-a", { status: "active" }),
    );
    const unsubscribe = observer.subscribe(() => undefined);
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    const save = customersApi.create({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      name: "Maria",
    });
    expect(requests[1]?.method).toBe("POST");
    expect(requests[1]?.signal).toBeUndefined();
    unsubscribe();
    expect(requests[0]?.signal?.aborted).toBe(true);
    const saved = { customer: { name: "Maria" }, replayed: false };
    requests[1]?.resolve(saved);
    await expect(save).resolves.toBe(saved);
    expect(requests).toHaveLength(2);
  });
});
