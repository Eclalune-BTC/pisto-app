import type { BusinessPeriod, BusinessTopic } from "@pisto/contracts";
import { queryOptions, skipToken, useQuery } from "@tanstack/react-query";

import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { isAccessDeniedError } from "@/lib/query-state";
import { assistantApi } from "./api";

export const assistantQueryKeys = {
  status: (businessId: string | undefined) => ["assistant", businessId, "status"] as const,
  answer: (businessId: string | undefined, topic: BusinessTopic, period: BusinessPeriod | null) =>
    ["assistant", businessId, "answer", topic, period] as const,
} as const;

/** One exact answer. It is read again on every mount, and a change notice refreshes it. */
export function businessAnswerQueryOptions(
  businessId: string | undefined,
  question: { topic: BusinessTopic; period: BusinessPeriod | null },
) {
  const { topic, period } = question;
  return queryOptions({
    queryKey: assistantQueryKeys.answer(businessId, topic, period),
    queryFn: businessId
      ? ({ signal }) =>
          assistantApi.answer(
            { expectedBusinessId: businessId, topic, ...(period && { period }) },
            signal,
          )
      : skipToken,
    staleTime: 0,
  });
}

function assistantStatusQueryOptions(businessId: string | undefined) {
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
  | {
      kind: "disabled";
      businessId: string;
      catalogConversation: boolean;
      businessConversation: boolean;
    }
  | {
      kind: "ready";
      businessId: string;
      transcription: boolean;
      catalogConversation: boolean;
      businessConversation: boolean;
    };

/** Whether the active member may use the assistant and the server reports it on. */
export function useAssistantAvailability(): AssistantAvailability {
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const permitted = business?.access.permissions.includes("assistant:use") ?? false;
  const status = useQuery(assistantStatusQueryOptions(permitted ? business?.id : undefined));
  if (
    !business ||
    !permitted ||
    isAccessDeniedError(businesses.error) ||
    isAccessDeniedError(status.error)
  )
    return { kind: "hidden" };
  if (status.data) {
    return status.data.enabled
      ? {
          kind: "ready",
          businessId: business.id,
          transcription: status.data.transcription,
          businessConversation: status.data.businessConversation === true,
          catalogConversation: status.data.catalogConversation === true,
        }
      : {
          kind: "disabled",
          businessId: business.id,
          businessConversation: status.data.businessConversation === true,
          catalogConversation: status.data.catalogConversation === true,
        };
  }
  if (status.isError) {
    return { kind: "error", businessId: business.id, retry: () => void status.refetch() };
  }
  return { kind: "loading", businessId: business.id };
}
