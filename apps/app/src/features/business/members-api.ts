import {
  type AddBusinessMemberRequest,
  type AddBusinessMemberResponse,
  addBusinessMemberRequestSchema,
  addBusinessMemberResponseSchema,
  type BusinessMemberCommandResponse,
  type BusinessMembersResponse,
  businessMemberCommandResponseSchema,
  businessMembersResponseSchema,
  type ChangeBusinessMemberRoleRequest,
  changeBusinessMemberRoleRequestSchema,
  type RemoveBusinessMemberRequest,
  removeBusinessMemberRequestSchema,
} from "@pisto/contracts";
import { apiRequest, parseRequestPayload } from "@/lib/api-client";

/** Realtime notices refetch every query keyed `[area, businessId]`, this one included. */
export function membersQueryKey(businessId: string) {
  return ["business-members", businessId] as const;
}

const memberPath = (memberId: string) =>
  `/v1/businesses/members/${encodeURIComponent(memberId)}` as const;

export const membersApi = {
  list: (signal?: AbortSignal) =>
    apiRequest<BusinessMembersResponse, BusinessMembersResponse["data"]>(
      "/v1/businesses/members",
      { authenticated: true, signal },
      businessMembersResponseSchema,
    ),
  add: (command: AddBusinessMemberRequest) =>
    apiRequest<AddBusinessMemberResponse, AddBusinessMemberResponse["data"]>(
      "/v1/businesses/members",
      {
        authenticated: true,
        body: parseRequestPayload(addBusinessMemberRequestSchema, command),
        method: "POST",
      },
      addBusinessMemberResponseSchema,
    ),
  changeRole: (memberId: string, command: ChangeBusinessMemberRoleRequest) =>
    apiRequest<BusinessMemberCommandResponse, BusinessMemberCommandResponse["data"]>(
      memberPath(memberId),
      {
        authenticated: true,
        body: parseRequestPayload(changeBusinessMemberRoleRequestSchema, command),
        method: "PATCH",
      },
      businessMemberCommandResponseSchema,
    ),
  remove: (memberId: string, command: RemoveBusinessMemberRequest) =>
    apiRequest<BusinessMemberCommandResponse, BusinessMemberCommandResponse["data"]>(
      `${memberPath(memberId)}/remove`,
      {
        authenticated: true,
        body: parseRequestPayload(removeBusinessMemberRequestSchema, command),
        method: "POST",
      },
      businessMemberCommandResponseSchema,
    ),
};
