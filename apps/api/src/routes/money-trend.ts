import { moneyTrendQuerySchema } from "@pisto/contracts";
import type { MoneyTrendRepository } from "@pisto/db";

import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes, queryContract } from "./protected.ts";

export function moneyTrendRoutes(input: {
  access: ProductAccess;
  moneyTrend: MoneyTrendRepository;
}) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/reports/money-trend",
    async ({ actor, query }) => {
      const trend = await input.moneyTrend.getMoneyTrend(actor, query);
      return { data: { trend } };
    },
    {
      ...queryContract(moneyTrendQuerySchema, "Money trend range is invalid"),
    },
  );
  return routes;
}
