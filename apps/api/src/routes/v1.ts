import type { Auth } from "@pisto/auth";
import { Elysia } from "elysia";
import { activeOrganizationId, sessionContext } from "../session.ts";

const versionMarker = () => ({
  data: { version: "v1" as const, service: "pisto-api" as const },
});

/** The version marker and account summary own their session policy, outside the request budget. */
export function v1Routes(input: { auth: Auth }) {
  return new Elysia({ strictPath: true })
    .get("/v1", versionMarker)
    .get("/v1/", versionMarker)
    .use(sessionContext(input.auth))
    .get("/v1/me", ({ session }) => ({
      data: {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          emailVerified: session.user.emailVerified,
          image: session.user.image ?? null,
        },
        session: {
          id: session.session.id,
          expiresAt: new Date(session.session.expiresAt).toISOString(),
          activeOrganizationId: activeOrganizationId(session),
        },
      },
    }));
}
