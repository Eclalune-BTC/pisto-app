import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "./api-error";
import { shouldRetryQuery } from "./query-policy";

export function createSessionQueryClient(refetchSession: () => Promise<unknown>) {
  let active = true;
  let recovering = false;
  const onError = (error: unknown) => {
    if (
      !active ||
      recovering ||
      !(error instanceof ApiClientError) ||
      (error.status !== 401 && error.code !== "UNAUTHORIZED")
    )
      return;
    recovering = true;
    // Refresh the session atom. Signing out here could revoke a newer session
    // established in another tab while this request was in flight.
    void refetchSession()
      .catch(() => undefined)
      .finally(() => {
        recovering = false;
      });
  };
  const client = new QueryClient({
    mutationCache: new MutationCache({ onError }),
    queryCache: new QueryCache({ onError }),
    defaultOptions: {
      queries: { retry: shouldRetryQuery, staleTime: 30_000 },
      // A manual confirmation must fail visibly offline, never enter an
      // implicit queue that executes after the user leaves the screen.
      mutations: { networkMode: "always", retry: 0 },
    },
  });
  return {
    client,
    activate: () => {
      active = true;
    },
    dispose: () => {
      active = false;
      client.clear();
    },
  };
}
