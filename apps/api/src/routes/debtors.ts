import type { DebtorsRepository } from "@pisto/db";

import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes } from "./protected.ts";

export function debtorsRoutes(input: { access: ProductAccess; debtors: DebtorsRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get("/receivables/debtors", async ({ actor }) => {
    const debtors = await input.debtors.getDebtors(actor);
    return { data: { debtors } };
  });
  return routes;
}
