import type { Auth } from "@pisto/auth";
import { type Database, member, type ProductActor } from "@pisto/db";
import { and, eq } from "drizzle-orm";

import { ApiError } from "./errors.ts";

type SessionRequestContext = { req: { raw: Request } };

export async function requireSession(auth: Auth, headers: Headers) {
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return session;
}

function toProductActor(
  authSession: NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>,
): ProductActor {
  const sessionRecord = authSession.session as typeof authSession.session & {
    activeOrganizationId?: string | null;
  };
  return {
    userId: authSession.user.id,
    sessionId: sessionRecord.id,
    activeBusinessId: sessionRecord.activeOrganizationId ?? null,
  };
}

/**
 * Resolve the acting subject and its business from fresh server session state.
 * Every protected domain handler starts with this call, so tenancy is never read
 * from a request body, query, or path.
 */
export async function requireActor(
  auth: Auth,
  context: SessionRequestContext,
): Promise<ProductActor> {
  return toProductActor(await requireSession(auth, context.req.raw.headers));
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
