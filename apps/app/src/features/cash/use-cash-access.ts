import type { BusinessPermission } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";

import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";

type Capability = "cash" | "expenses";

const permissions: Record<Capability, { manage: BusinessPermission; read: BusinessPermission }> = {
  cash: { manage: "cash:manage", read: "cash:read" },
  expenses: { manage: "expenses:manage", read: "expenses:read" },
};

export function useCashAccess(capability: Capability) {
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const capabilityPermissions = permissions[capability];
  const effectivePermissions = business?.access.permissions ?? [];

  return {
    business,
    businesses,
    canManage: effectivePermissions.includes(capabilityPermissions.manage),
    canRead: effectivePermissions.includes(capabilityPermissions.read),
    isStale: businesses.isError && businesses.data !== undefined,
  };
}
