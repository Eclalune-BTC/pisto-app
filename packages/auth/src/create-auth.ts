import { expo } from "@better-auth/expo";
import type { BillingRuntime } from "@pisto/billing";
import { authSchema, type Database } from "@pisto/db";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { organization } from "better-auth/plugins";

import type { AuthConfig } from "./env.ts";

export function createAuth(input: { config: AuthConfig; db: Database; billing: BillingRuntime }) {
  const plugins: BetterAuthPlugin[] = [
    {
      id: "pisto-error-privacy",
      async onResponse(response) {
        if (response.status < 500) return;
        // Better Auth may convert a provider APIError to a Response before
        // onAPIError runs. Sanitize that second path while keeping cookie headers.
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        return {
          response: Response.json(
            { message: "Authentication request failed" },
            { status: response.status, headers },
          ),
        };
      },
    },
    expo(),
    organization({
      allowUserToCreateOrganization: false,
      creatorRole: "owner",
      disableOrganizationDeletion: true,
      organizationLimit: 1,
    }),
  ];
  if (input.billing.polar.plugin) plugins.push(input.billing.polar.plugin);

  return betterAuth({
    appName: "Pisto",
    baseURL: input.config.baseUrl,
    basePath: "/api/auth",
    ...(input.config.secret ? { secret: input.config.secret } : {}),
    ...(input.config.secrets ? { secrets: input.config.secrets } : {}),
    database: drizzleAdapter(input.db, {
      provider: "pg",
      schema: authSchema,
    }),
    emailAndPassword: {
      enabled: input.config.emailAndPasswordEnabled,
    },
    trustedOrigins: input.config.trustedOrigins,
    // Auth handles errors before Hono's boundary. Provider/driver diagnostics can
    // contain credentials, SQL parameters, and customer data, so keep only level.
    logger: {
      log(level) {
        const entry = JSON.stringify({ level, message: "Authentication provider diagnostic" });
        if (level === "error") console.error(entry);
        else if (level === "warn") console.warn(entry);
        else console.info(entry);
      },
    },
    onAPIError: {
      onError(error) {
        if (error instanceof APIError && error.status !== "INTERNAL_SERVER_ERROR") return;
        console.error(JSON.stringify({ level: "error", message: "Authentication request failed" }));
        // Throw a safe APIError so Better Call returns it without its fallback
        // console.error of the original exception, which bypasses logger.log.
        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Authentication request failed",
        });
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 10, max: 3 },
        "/sign-up/email": { window: 10, max: 3 },
        "/request-password-reset": { window: 60, max: 3 },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5,
      },
    },
    advanced: {
      cookiePrefix: "pisto",
      useSecureCookies: input.config.production,
      trustedProxyHeaders: input.config.trustedProxyHeaders,
    },
    plugins,
  });
}

export type Auth = ReturnType<typeof createAuth>;
