import type { OperatingReportQuery } from "@pisto/contracts";
import { queryOptions, skipToken } from "@tanstack/react-query";

import { reportsApi } from "./api";

export const reportsQueryKeys = {
  all: (businessId: string | undefined) => ["reports", businessId] as const,
  operating: (businessId: string | undefined) =>
    [...reportsQueryKeys.all(businessId), "operating"] as const,
  operatingRange: (businessId: string | undefined, range: OperatingReportQuery) =>
    [...reportsQueryKeys.operating(businessId), range.startLocalDate, range.endLocalDate] as const,
  cashFlow: (businessId: string | undefined, endMonth: string, months: number) =>
    [...reportsQueryKeys.all(businessId), "cash-flow", endMonth, months] as const,
} as const;

export function operatingReportQueryOptions(
  businessId: string | undefined,
  range: OperatingReportQuery,
) {
  return queryOptions({
    queryFn:
      businessId && range.startLocalDate && range.endLocalDate
        ? ({ signal }) => reportsApi.operating(range, signal)
        : skipToken,
    queryKey: reportsQueryKeys.operatingRange(businessId, range),
  });
}

export function cashFlowReportQueryOptions(
  businessId: string | undefined,
  endMonth: string,
  months: number,
) {
  return queryOptions({
    queryFn:
      businessId && endMonth
        ? ({ signal }) => reportsApi.cashFlow({ endMonth, months }, signal)
        : skipToken,
    queryKey: reportsQueryKeys.cashFlow(businessId, endMonth, months),
  });
}
