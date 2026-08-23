import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/api-client";
import { cashQueryKeys } from "../cash/queries";

const cashAccountChoiceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  status: z.enum(["active", "archived"]),
});

const cashAccountChoicesResponseSchema = z.object({
  data: z.object({
    items: z.array(cashAccountChoiceSchema),
    nextCursor: z.string().min(1).nullable(),
    queriedAt: z.string().datetime({ offset: true }),
  }),
});

const cashAccountChoiceDetailResponseSchema = z.object({
  data: z.object({ account: cashAccountChoiceSchema }),
});

export type CashAccountChoice = z.infer<typeof cashAccountChoiceSchema>;
type CashAccountChoicesResponse = z.infer<typeof cashAccountChoicesResponseSchema>;
type CashAccountChoiceDetailResponse = z.infer<typeof cashAccountChoiceDetailResponseSchema>;

// Nested under the cash accounts key on purpose: invalidateCashLedger
// invalidates cashQueryKeys.accounts(businessId), and TanStack matches by
// prefix. A sibling namespace was never reached, so archiving a cash account
// left it selectable here.
export const receivableCashAccountKeys = {
  all: (businessId: string) =>
    [...cashQueryKeys.accounts(businessId), "receivable-account-choice"] as const,
  detail: (businessId: string, accountId: string) =>
    [...receivableCashAccountKeys.all(businessId), "detail", accountId] as const,
  list: (businessId: string, status: "active" | "all") =>
    [...receivableCashAccountKeys.all(businessId), "list", status] as const,
};

export const receivableCashAccountSource = {
  list: (input: { cursor?: string; status: "active" | "all" }) => {
    const params = new URLSearchParams({ limit: "50", status: input.status });
    if (input.cursor) params.set("cursor", input.cursor);
    return apiRequest<CashAccountChoicesResponse, CashAccountChoicesResponse["data"]>(
      `/v1/cash/accounts?${params.toString()}`,
      { authenticated: true },
      cashAccountChoicesResponseSchema,
    );
  },
  get: (accountId: string) =>
    apiRequest<CashAccountChoiceDetailResponse, CashAccountChoiceDetailResponse["data"]>(
      `/v1/cash/accounts/${encodeURIComponent(accountId)}`,
      { authenticated: true },
      cashAccountChoiceDetailResponseSchema,
    ),
} as const;

export function cashAccountDetailQueryOptions(businessId: string, accountId: string) {
  return queryOptions({
    queryKey: receivableCashAccountKeys.detail(businessId, accountId),
    queryFn: () => receivableCashAccountSource.get(accountId),
  });
}

export function cashAccountChoicesQueryOptions(
  businessId: string,
  status: "active" | "all" = "active",
) {
  return infiniteQueryOptions({
    initialPageParam: null as string | null,
    queryKey: receivableCashAccountKeys.list(businessId, status),
    queryFn: ({ pageParam }) =>
      receivableCashAccountSource.list({ cursor: pageParam ?? undefined, status }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
