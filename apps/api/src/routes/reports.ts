import { operatingReportQuerySchema } from "@pisto/contracts";
import type { ReportsRepository } from "@pisto/db";

import { contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes } from "./protected.ts";

export function reportsRoutes(input: { access: ProductAccess; reports: ReportsRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/reports/operating",
    async ({ actor, query }) => {
      const report = await input.reports.getOperatingReport(actor, query);
      return { data: { report } };
    },
    {
      query: contract(operatingReportQuerySchema, "Operating report range is invalid"),
      queryPolicy: ["startLocalDate", "endLocalDate"],
    },
  );
  return routes;
}
