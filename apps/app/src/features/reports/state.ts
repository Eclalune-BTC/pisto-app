import type { OperatingReport } from "@pisto/contracts";

import type { FeatureRemoteState } from "../cash/feature-boundary";
import { featureRemoteState, queryHasStaleData } from "../cash/remote-state";

export type ReportsScreenState =
  | Exclude<FeatureRemoteState, { kind: "ready" }>
  | { isStale: boolean; kind: "ready"; report: OperatingReport };

type RemoteQuery<Data> = {
  data: Data | undefined;
  error: unknown;
  fetchStatus: "fetching" | "paused" | "idle";
  isError: boolean;
  isPending: boolean;
};

export function reportsScreenState(input: {
  businesses: RemoteQuery<unknown>;
  canRead: boolean;
  offlineMessage: string;
  report: RemoteQuery<{ report: OperatingReport }>;
  unavailableMessage: string;
}): ReportsScreenState {
  const remoteState = featureRemoteState({
    businessPending: input.businesses.isPending,
    canRead: input.canRead,
    offlineMessage: input.offlineMessage,
    queries: input.canRead ? [input.businesses, input.report] : [input.businesses],
    unavailableMessage: input.unavailableMessage,
  });
  if (remoteState.kind !== "ready") return remoteState;
  if (!input.report.data) return { kind: "loading" };
  return {
    isStale:
      (input.businesses.isError && input.businesses.data !== undefined) ||
      queryHasStaleData(input.report),
    kind: "ready",
    report: input.report.data.report,
  };
}
