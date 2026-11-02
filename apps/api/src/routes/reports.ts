import { cashFlowReportQuerySchema, operatingReportQuerySchema } from "@pisto/contracts";
import type { ReportsRepository } from "@pisto/db";

import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes, queryContract } from "./protected.ts";

export function reportsRoutes(input: { access: ProductAccess; reports: ReportsRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/reports/operating",
    async ({ actor, query }) => {
      const report = await input.reports.getOperatingReport(actor, query);
      return { data: { report } };
    },
    {
      ...queryContract(operatingReportQuerySchema, "Operating report range is invalid"),
    },
  );
  routes.get(
    "/reports/cash-flow",
    async ({ actor, query }) => {
      const report = await input.reports.getCashFlowReport(actor, query);
      return { data: { report } };
    },
    {
      ...queryContract(cashFlowReportQuerySchema, "Cash flow months are invalid"),
    },
  );
  return routes;
}
