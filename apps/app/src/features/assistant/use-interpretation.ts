import type { AssistantInterpretRequest } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef } from "react";

import { authClient } from "@/lib/auth-client";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { isAccessDeniedError } from "@/lib/query-state";

import { assistantApi } from "./api";
import {
  type CocoTool,
  matchBusinessQuestion,
  matchSaleTool,
  permitsReply,
  permitsTool,
} from "./business-questions";
import { type AssistantProblem, assistantProblem, type UnsupportedReason } from "./problems";
import { assistantQueryKeys } from "./queries";
import { reviewStore } from "./review-store";

const REVIEW_ROUTE = "/operate/assistant/review";

export type InterpretOutcome =
  | { kind: "review" }
  | { kind: "tool"; tool: CocoTool }
  | { kind: "unsupported"; reason: UnsupportedReason }
  | { kind: "failed"; problem: AssistantProblem }
  /** The caller went away (a closed dialog) before the answer arrived; nothing was shown. */
  | { kind: "abandoned" };

/**
 * Sends one sentence for interpretation. A draft goes to the review route through the in-memory
 * store; a sentence that is not one record, or a failure, is returned for the caller to show next
 * to the text the user can still edit.
 */
export function useInterpretation(businessId: string | undefined, businessConversation = false) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const userId = authClient.useSession().data?.user.id;
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!businessId || !userId) return;
    return () => inFlight.current?.abort();
  }, [businessId, userId]);
  const conversation = useMutation({
    mutationFn: ({
      text,
      previousQuestions,
      expectedBusinessId,
      signal,
    }: {
      text: string;
      previousQuestions: string[];
      expectedBusinessId: string;
      signal: AbortSignal;
    }) => assistantApi.businessTurn({ text, previousQuestions, expectedBusinessId }, signal),
  });
  const mutation = useMutation({
    mutationFn: (request: AssistantInterpretRequest) => assistantApi.interpret(request),
  });

  async function interpret(
    request: AssistantInterpretRequest,
    abandoned: () => boolean = () => false,
    previousQuestions: string[] = [],
  ): Promise<InterpretOutcome> {
    // Callers render only for a loaded business; without one there is nowhere to keep a draft.
    if (!businessId || !userId) return { kind: "failed", problem: "unexpected" };
    function currentBusiness() {
      const businesses = queryClient.getQueryState(businessesQueryOptions.queryKey);
      const business = getActiveBusiness(queryClient.getQueryData(businessesQueryOptions.queryKey));
      return business?.id === businessId &&
        !isAccessDeniedError(businesses?.error) &&
        business?.access.permissions.includes("assistant:use")
        ? business
        : undefined;
    }
    const business = currentBusiness();
    if (!business) return { kind: "failed", problem: "denied" };
    const launcher = request.allowTools && matchSaleTool(request.text);
    if (launcher)
      return permitsTool(business.access.permissions, launcher)
        ? { kind: "tool", tool: launcher }
        : { kind: "failed", problem: "denied" };
    const question =
      request.allowTools && !businessConversation && matchBusinessQuestion(request.text);
    if (question) return { kind: "tool", tool: question };
    try {
      if (businessConversation && request.allowTools) {
        const controller = new AbortController();
        inFlight.current?.abort();
        inFlight.current = controller;
        const { reply } = await conversation.mutateAsync({
          text: request.text,
          previousQuestions,
          expectedBusinessId: businessId,
          signal: controller.signal,
        });
        if (abandoned() || controller.signal.aborted) return { kind: "abandoned" };
        const active = currentBusiness();
        if (!active) return { kind: "failed", problem: "denied" };
        if (reply.kind !== "record")
          return permitsReply(active.access.permissions, reply)
            ? { kind: "tool", tool: { name: "business_reply", reply } }
            : { kind: "failed", problem: "denied" };
      }
      const interpretation = await mutation.mutateAsync({
        ...request,
        expectedBusinessId: businessId,
      });
      if (abandoned()) return { kind: "abandoned" };
      const active = currentBusiness();
      if (!active) return { kind: "failed", problem: "denied" };
      if (interpretation.tool) {
        return request.allowTools && permitsTool(active.access.permissions, interpretation.tool)
          ? { kind: "tool", tool: interpretation.tool }
          : { kind: "failed", problem: "denied" };
      }
      if (!interpretation.draft) {
        return interpretation.unsupported
          ? { kind: "unsupported", reason: interpretation.unsupported }
          : { kind: "failed", problem: "unexpected" };
      }
      reviewStore.set({ userId, businessId, interpretation });
      if (pathname !== REVIEW_ROUTE) router.push(REVIEW_ROUTE);
      return { kind: "review" };
    } catch (error) {
      const problem = assistantProblem(error);
      // The status tells a switched-off assistant from a provider outage.
      if (problem === "provider") {
        void queryClient.invalidateQueries({ queryKey: assistantQueryKeys.status(businessId) });
      }
      return { kind: "failed", problem };
    }
  }

  return { interpret, pending: mutation.isPending || conversation.isPending };
}
