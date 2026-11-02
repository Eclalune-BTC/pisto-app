import {
  type DebtorsResponse,
  debtorsResponseSchema,
  type MoneyTrendRange,
  type MoneyTrendResponse,
  type MovementListQuery,
  type MovementListResponse,
  moneyTrendResponseSchema,
  movementListResponseSchema,
} from "@pisto/contracts";
import { apiRequest, pathWithQuery } from "@/lib/api-client";

export const movementsApi = {
  list: (query: MovementListQuery, signal?: AbortSignal) =>
    apiRequest<MovementListResponse, MovementListResponse["data"]>(
      pathWithQuery("/v1/movements", query),
      { authenticated: true, signal },
      movementListResponseSchema,
    ),
  moneyTrend: async (range: MoneyTrendRange, signal?: AbortSignal) =>
    (
      await apiRequest<MoneyTrendResponse, MoneyTrendResponse["data"]>(
        pathWithQuery("/v1/reports/money-trend", { range }),
        { authenticated: true, signal },
        moneyTrendResponseSchema,
      )
    ).trend,
  debtors: async (signal?: AbortSignal) =>
    (
      await apiRequest<DebtorsResponse, DebtorsResponse["data"]>(
        "/v1/receivables/debtors",
        { authenticated: true, signal },
        debtorsResponseSchema,
      )
    ).debtors,
} as const;
