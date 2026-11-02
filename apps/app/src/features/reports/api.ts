import type {
  CashFlowReportResponse,
  OperatingReportQuery,
  OperatingReportResponse,
} from "@pisto/contracts";
import { cashFlowReportResponseSchema, operatingReportResponseSchema } from "@pisto/contracts";
import { apiRequest } from "@/lib/api-client";

export const reportsApi = {
  operating: (query: OperatingReportQuery, signal?: AbortSignal) =>
    apiRequest<OperatingReportResponse, OperatingReportResponse["data"]>(
      `/v1/reports/operating?startLocalDate=${encodeURIComponent(query.startLocalDate)}&endLocalDate=${encodeURIComponent(query.endLocalDate)}`,
      { authenticated: true, signal },
      operatingReportResponseSchema,
    ),
  cashFlow: (query: { endMonth: string; months: number }, signal?: AbortSignal) =>
    apiRequest<CashFlowReportResponse, CashFlowReportResponse["data"]>(
      `/v1/reports/cash-flow?endMonth=${encodeURIComponent(query.endMonth)}&months=${query.months}`,
      { authenticated: true, signal },
      cashFlowReportResponseSchema,
    ),
} as const;
