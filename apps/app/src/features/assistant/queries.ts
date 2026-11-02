import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";

import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { assistantApi } from "./api";

export const assistantQueryKeys = {
  status: (businessId: string | undefined) => ["assistant", businessId, "status"] as const,
} as const;

export function assistantStatusQueryOptions(businessId: string | undefined) {
  return queryOptions({
    queryKey: assistantQueryKeys.status(businessId),
    queryFn: businessId ? ({ signal }) => assistantApi.status(signal) : skipToken,
    staleTime: 60_000,
  });
}

export type AssistantAvailability =
  /** No active business, or the role cannot use the assistant: there is no entry point. */
  | { kind: "hidden" }
  | { kind: "loading"; businessId: string }
  | { kind: "error"; businessId: string; retry: () => void }
  | { kind: "disabled"; businessId: string }
  | { kind: "ready"; businessId: string; transcription: boolean };

/** Whether the active member may use the assistant and the server reports it on. */
export function useAssistantAvailability(): AssistantAvailability {
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const permitted = business?.access.permissions.includes("assistant:use") ?? false;
  const status = useQuery(assistantStatusQueryOptions(permitted ? business?.id : undefined));
  if (!business || !permitted) return { kind: "hidden" };
  if (status.data) {
    return status.data.enabled
      ? { kind: "ready", businessId: business.id, transcription: status.data.transcription }
      : { kind: "disabled", businessId: business.id };
  }
  if (status.isError) {
    return { kind: "error", businessId: business.id, retry: () => void status.refetch() };
  }
  return { kind: "loading", businessId: business.id };
}
