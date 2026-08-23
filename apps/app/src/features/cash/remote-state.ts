import { ApiClientError } from "@/lib/api-error";

import type { FeatureRemoteState } from "./feature-boundary";

type RemoteQuery = {
  data: unknown;
  error: unknown;
  fetchStatus: "fetching" | "paused" | "idle";
  isError: boolean;
  isPending: boolean;
};

export function featureRemoteState(input: {
  businessPending: boolean;
  canRead: boolean;
  queries?: readonly RemoteQuery[];
  unavailableMessage: string;
  offlineMessage: string;
}): FeatureRemoteState {
  const queries = input.queries ?? [];
  const firstTerminalError = queries.find(({ isError, data }) => isError && data === undefined);
  if (firstTerminalError) {
    if (
      firstTerminalError.error instanceof ApiClientError &&
      firstTerminalError.error.code === "FORBIDDEN"
    ) {
      return { kind: "denied" };
    }
    return {
      kind: "error",
      message:
        firstTerminalError.fetchStatus === "paused"
          ? input.offlineMessage
          : input.unavailableMessage,
    };
  }
  // A query paused for connectivity never reports an error, so it has to be
  // discriminated before the pending check or it renders as a spinner forever.
  if (queries.some(({ fetchStatus, data }) => fetchStatus === "paused" && data === undefined)) {
    return { kind: "offline", message: input.offlineMessage };
  }
  if (input.businessPending) return { kind: "loading" };
  if (!input.canRead) return { kind: "denied" };
  if (queries.some(({ isPending, data }) => isPending && data === undefined)) {
    return { kind: "loading" };
  }
  return { kind: "ready" };
}

/**
 * Cached data that could not be refreshed. A paused query counts: the screen
 * still renders balances, but they are as old as the last successful read, and
 * confirming a financial operation against them would be a decision made on
 * numbers nobody could verify.
 */
export function queryHasStaleData(query: RemoteQuery): boolean {
  if (query.data === undefined) return false;
  return query.isError || query.fetchStatus === "paused";
}
