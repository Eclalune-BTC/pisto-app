import type { Auth } from "@pisto/auth";
import { type Database, member, type ProductActor } from "@pisto/db";
import { and, eq } from "drizzle-orm";
import { Elysia } from "elysia";

import { ApiError } from "./errors.ts";

export type AuthSession = NonNullable<Awaited<ReturnType<Auth["api"]["getSession"]>>>;

export async function requireSession(auth: Auth, headers: Headers): Promise<AuthSession> {
  const session = await auth.api.getSession({
    headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication is required");
  }
  return session;
}

/**
 * `Auth` declares its plugins as `BetterAuthPlugin[]`, which erases the organization plugin's
 * session field from the inferred type. This is the single place that restores it.
 */
export function activeOrganizationId(authSession: AuthSession): string | null {
  const session = authSession.session as AuthSession["session"] & {
    activeOrganizationId?: string | null;
  };
  return session.activeOrganizationId ?? null;
}

export function toProductActor(authSession: AuthSession): ProductActor {
  return {
    userId: authSession.user.id,
    sessionId: authSession.session.id,
    activeBusinessId: activeOrganizationId(authSession),
  };
}

/**
 * Session-only routes (account and billing) bypass the business request budget. `derive` runs
 * before schema validation, so an anonymous caller never learns which bodies would be accepted.
 */
export function sessionContext(auth: Auth) {
  return new Elysia().derive({ as: "scoped" }, async ({ request }) => ({
    session: await requireSession(auth, request.headers),
  }));
}

export async function resolveBillingScope(input: { db: Database; session: AuthSession }) {
  const organizationId = activeOrganizationId(input.session);
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
