import type { OperatingReportQuery, OperatingReportResponse } from "@pisto/contracts";
import { operatingReportResponseSchema } from "@pisto/contracts";
import { apiRequest } from "@/lib/api-client";

export const reportsApi = {
  operating: (query: OperatingReportQuery) =>
    apiRequest<OperatingReportResponse, OperatingReportResponse["data"]>(
      `/v1/reports/operating?startLocalDate=${encodeURIComponent(query.startLocalDate)}&endLocalDate=${encodeURIComponent(query.endLocalDate)}`,
      { authenticated: true },
      operatingReportResponseSchema,
    ),
} as const;
