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
  if (input.businessPending) return { kind: "loading" };
  if (!input.canRead) return { kind: "denied" };
  if (queries.some(({ isPending, data }) => isPending && data === undefined)) {
    return { kind: "loading" };
  }
  return { kind: "ready" };
}

export function queryHasStaleData(query: RemoteQuery): boolean {
  return query.isError && query.data !== undefined;
}
