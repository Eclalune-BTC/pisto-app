import type { Auth } from "@pisto/auth";
import { operatingReportQuerySchema } from "@pisto/contracts";
import type { ReportsRepository } from "@pisto/db";
import { Hono } from "hono";

import { parseRequest } from "../http.ts";
import { requireActor } from "../session.ts";
import type { AppEnv } from "../types.ts";

export function reportsRoutes(input: { auth: Auth; reports: ReportsRepository }) {
  const routes = new Hono<AppEnv>();

  routes.get("/reports/operating", async (context) => {
    const actor = await requireActor(input.auth, context);
    const query = parseRequest(
      operatingReportQuerySchema,
      {
        startLocalDate: context.req.query("startLocalDate"),
        endLocalDate: context.req.query("endLocalDate"),
      },
      "Operating report range is invalid",
    );
    const report = await input.reports.getOperatingReport(actor, query);
    return context.json({ data: { report } });
  });

  return routes;
}
