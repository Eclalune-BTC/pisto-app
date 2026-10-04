import { queryOptions } from "@tanstack/react-query";

import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

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

export async function selectActiveBusiness(organizationId: string) {
  const result = await authClient.organization.setActive({ organizationId });
  if (result.error) throw new Error("The active business could not be selected.");
}
