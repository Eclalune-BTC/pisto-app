import { createBusinessRequestSchema } from "@pisto/contracts";
import type { BusinessRepository } from "@pisto/db";

import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes } from "./protected.ts";

export function businessRoutes(input: { access: ProductAccess; businesses: BusinessRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get("/businesses", async ({ actor }) => {
    return { data: await input.businesses.listBusinesses(actor) };
  });

  routes.post(
    "/businesses",
    async ({ actor, body }) => {
      return commandResponse(await input.businesses.createBusiness(actor, body));
    },
    {
      parse: "json",
      body: contract(createBusinessRequestSchema, "Business settings are invalid"),
    },
  );
  return routes;
}
