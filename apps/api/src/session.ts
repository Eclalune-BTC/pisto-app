import type { Auth } from "@pisto/auth";
import { type Database, member } from "@pisto/db";
import { and, eq } from "drizzle-orm";

import { ApiError } from "./errors.ts";

export async function requireSession(auth: Auth, headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return session;
}

export async function resolveBillingScope(input: {
  db: Database;
  session: Awaited<ReturnType<Auth["api"]["getSession"]>> & {};
}) {
  const sessionRecord = input.session.session as typeof input.session.session & {
    activeOrganizationId?: string | null;
  };
  const organizationId = sessionRecord.activeOrganizationId ?? null;
  if (!organizationId) {
    return { type: "user" as const, id: input.session.user.id };
  }
  const [activeMembership] = await input.db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, input.session.user.id)))
    .limit(1);
  if (!activeMembership) {
    throw new ApiError(403, "FORBIDDEN", "The active organization membership is no longer valid");
  }
  return { type: "organization" as const, id: organizationId };
}
