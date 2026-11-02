import {
  addBusinessMemberRequestSchema,
  changeBusinessMemberRoleRequestSchema,
  removeBusinessMemberRequestSchema,
} from "@pisto/contracts";
import type { BusinessMembersRepository } from "@pisto/db";

import { commandResponse, contract } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { protectedRoutes } from "./protected.ts";

const memberNotFound = "Member was not found";

/** The owner's staff commands; `GET /v1/businesses/members` stays with the business routes. */
export function memberRoutes(input: { access: ProductAccess; members: BusinessMembersRepository }) {
  const routes = protectedRoutes(input.access);
  routes.post(
    "/businesses/members",
    async ({ actor, body }) => {
      return commandResponse(await input.members.addMember(actor, body));
    },
    {
      parse: "json",
      body: contract(addBusinessMemberRequestSchema, "Staff member details are invalid"),
    },
  );
  routes.patch(
    "/businesses/members/:memberId",
    async ({ actor, body, params }) => {
      return { data: await input.members.changeMemberRole(actor, params.memberId, body) };
    },
    {
      record: { memberId: memberNotFound },
      body: contract(changeBusinessMemberRoleRequestSchema, "Role change is invalid"),
    },
  );
  routes.post(
    "/businesses/members/:memberId/remove",
    async ({ actor, body, params }) => {
      return { data: await input.members.removeMember(actor, params.memberId, body) };
    },
    {
      record: { memberId: memberNotFound },
      body: contract(removeBusinessMemberRequestSchema, "Member removal is invalid"),
    },
  );
  return routes;
}
