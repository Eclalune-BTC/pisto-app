import { expo } from "@better-auth/expo";
import type { BillingRuntime } from "@pisto/billing";
import { authSchema, type Database } from "@pisto/db";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

import type { AuthConfig } from "./env.ts";

export function createAuth(input: { config: AuthConfig; db: Database; billing: BillingRuntime }) {
  const plugins: BetterAuthPlugin[] = [expo(), organization()];
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
