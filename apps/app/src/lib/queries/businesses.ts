import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";

export const businessesQueryKey = ["businesses"] as const;

export const businessesQueryOptions = queryOptions({
  queryFn: api.businesses.list,
  queryKey: businessesQueryKey,
});

export function getActiveBusiness(
  data: Awaited<ReturnType<typeof api.businesses.list>> | undefined,
) {
  return data?.items.find(({ id }) => id === data.activeBusinessId);
}
