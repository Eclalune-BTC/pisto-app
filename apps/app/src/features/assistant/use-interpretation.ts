import type { AssistantInterpretRequest, AssistantToolCall } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";

import { authClient } from "@/lib/auth-client";
import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { isAccessDeniedError } from "@/lib/query-state";

import { assistantApi } from "./api";
import { matchBusinessQuestion, matchSaleTool, permitsTool } from "./business-questions";
import { type AssistantProblem, assistantProblem, type UnsupportedReason } from "./problems";
import { assistantQueryKeys } from "./queries";
import { reviewStore } from "./review-store";

const REVIEW_ROUTE = "/operate/assistant/review";

export type InterpretOutcome =
  | { kind: "review" }
  | { kind: "tool"; tool: AssistantToolCall }
  | { kind: "unsupported"; reason: UnsupportedReason }
  | { kind: "failed"; problem: AssistantProblem }
  /** The caller went away (a closed dialog) before the answer arrived; nothing was shown. */
  | { kind: "abandoned" };

/**
 * Sends one sentence for interpretation. A draft goes to the review route through the in-memory
 * store; a sentence that is not one record, or a failure, is returned for the caller to show next
 * to the text the user can still edit.
 */
export function useInterpretation(businessId: string | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const userId = authClient.useSession().data?.user.id;
  const mutation = useMutation({
    mutationFn: (request: AssistantInterpretRequest) => assistantApi.interpret(request),
  });

  async function interpret(
    request: AssistantInterpretRequest,
    abandoned: () => boolean = () => false,
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
    const question = request.allowTools && matchBusinessQuestion(request.text);
    if (question) return { kind: "tool", tool: question };
    try {
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

  return { interpret, pending: mutation.isPending };
}
