import type { OperatingReportQuery } from "@pisto/contracts";
import { queryOptions } from "@tanstack/react-query";

import { reportsApi } from "./api";

export const reportsQueryKeys = {
  all: (businessId: string) => ["reports", businessId] as const,
  operating: (businessId: string) => [...reportsQueryKeys.all(businessId), "operating"] as const,
  operatingRange: (businessId: string, range: OperatingReportQuery) =>
    [...reportsQueryKeys.operating(businessId), range.startLocalDate, range.endLocalDate] as const,
} as const;

export function operatingReportQueryOptions(businessId: string, range: OperatingReportQuery) {
  return queryOptions({
    queryFn: ({ signal }) => reportsApi.operating(range, signal),
    queryKey: reportsQueryKeys.operatingRange(businessId, range),
  });
}
