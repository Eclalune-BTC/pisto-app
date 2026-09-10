import type { Business, BusinessPermission } from "@pisto/contracts";
import { useQuery } from "@tanstack/react-query";

import { businessesQueryOptions, getActiveBusiness } from "@/lib/queries/businesses";
import { isAccessDeniedError } from "@/lib/query-state";
import type { CapabilityBoundaryState } from "./capability-boundary";

export type CapabilityAccess = {
  business: Business | undefined;
  canManage: boolean;
  canRead: boolean;
  isDenied: boolean;
  isError: boolean;
  isOffline: boolean;
  isPending: boolean;
  isStale: boolean;
  refetch: () => Promise<unknown>;
};

export function resolveBusinessPermission(
  business: Business | undefined,
  permission: BusinessPermission,
): boolean {
  return business?.access.permissions.includes(permission) ?? false;
}

export function useCapabilityAccess(
  readPermission: BusinessPermission,
  managePermission: BusinessPermission,
): CapabilityAccess {
  const businesses = useQuery(businessesQueryOptions);
  const business = getActiveBusiness(businesses.data);
  const hasReadPermission = resolveBusinessPermission(business, readPermission);
  const isDenied = isAccessDeniedError(businesses.error);

  return {
    business,
    canManage:
      !isDenied &&
      !businesses.isError &&
      businesses.fetchStatus !== "paused" &&
      resolveBusinessPermission(business, managePermission),
    canRead: !isDenied && hasReadPermission,
    isDenied,
    isError: businesses.isError && !businesses.data,
    isOffline: businesses.fetchStatus === "paused" && !businesses.data,
    isPending: businesses.isPending,
    isStale:
      (businesses.isError || businesses.fetchStatus === "paused") && Boolean(businesses.data),
    refetch: () => businesses.refetch(),
  };
}

export function capabilityBoundaryState(access: CapabilityAccess): CapabilityBoundaryState {
  if (access.isDenied) return "denied";
  if (access.isOffline) return "offline";
  if (access.isPending) return "loading";
  if (access.isError) return "error";
  if (access.business && !access.canRead) return "denied";
  return "ready";
}

export function manageCapabilityBoundaryState(access: CapabilityAccess): CapabilityBoundaryState {
  const state = capabilityBoundaryState(access);
  if (state !== "ready") return state;
  return access.business && !access.canManage ? "denied" : "ready";
}
