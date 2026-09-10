import { hasDeniedRead } from "@/lib/query-state";

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
  // An authoritative access rejection overrides any previously cached data.
  if (hasDeniedRead(queries)) return { kind: "denied" };
  const firstTerminalError = queries.find(({ isError, data }) => isError && data === undefined);
  if (firstTerminalError) {
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
