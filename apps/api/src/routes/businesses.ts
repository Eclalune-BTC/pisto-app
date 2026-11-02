import { createBusinessRequestSchema } from "@pisto/contracts";
import { type BusinessRepository, businessRoles, resolveBusinessAccess } from "@pisto/db";

import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes } from "./protected.ts";

export function businessRoutes(input: { access: ProductAccess; businesses: BusinessRepository }) {
  const routes = protectedRoutes(input.access);
  routes.get("/businesses", async ({ actor }) => {
    return { data: await input.businesses.listBusinesses(actor) };
  });

  routes.get("/businesses/members", async ({ actor }) => ({
    data: { members: await input.businesses.listMembers(actor) },
  }));

  // The role policy is the same for every business; members see what each role may do.
  routes.get("/businesses/roles", () => ({
    data: {
      roles: businessRoles.map((role) => {
        const access = resolveBusinessAccess(role);
        if (!access) throw new Error(`Business role ${role} has no policy`);
        return access;
      }),
    },
  }));

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
