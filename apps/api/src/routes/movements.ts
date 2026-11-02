import { movementListQuerySchema } from "@pisto/contracts";
import type { MovementsRepository } from "@pisto/db";

import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes, queryContract } from "./protected.ts";

export function movementsRoutes(input: { access: ProductAccess; movements: MovementsRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get(
    "/movements",
    async ({ actor, query }) => ({ data: await input.movements.listMovements(actor, query) }),
    {
      ...queryContract(movementListQuerySchema, "Movement list filters are invalid"),
    },
  );
  return routes;
}
