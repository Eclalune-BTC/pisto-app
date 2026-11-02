import type { AssistantInterpretRequest } from "@pisto/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";

import { assistantApi } from "./api";
import { type AssistantProblem, assistantProblem } from "./problems";
import { assistantQueryKeys } from "./queries";
import { reviewStore } from "./review-store";

export const REVIEW_ROUTE = "/operate/assistant/review";

export type InterpretOutcome =
  | { kind: "review" }
  | { kind: "unsupported"; reason: "not_a_record" | "several_records" }
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
  const mutation = useMutation({
    mutationFn: (request: AssistantInterpretRequest) => assistantApi.interpret(request),
  });

  async function interpret(
    request: AssistantInterpretRequest,
    abandoned: () => boolean = () => false,
  ): Promise<InterpretOutcome> {
    // Callers render only for a loaded business; without one there is nowhere to keep a draft.
    if (!businessId) return { kind: "failed", problem: "unexpected" };
    try {
      const interpretation = await mutation.mutateAsync(request);
      if (abandoned()) return { kind: "abandoned" };
      if (!interpretation.draft) {
        return interpretation.unsupported
          ? { kind: "unsupported", reason: interpretation.unsupported }
          : { kind: "failed", problem: "unexpected" };
      }
      reviewStore.set({ businessId, interpretation });
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
