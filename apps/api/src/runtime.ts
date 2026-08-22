import { createAuth, parseAuthConfig } from "@pisto/auth";
import { createBillingRuntime, parseBillingConfig } from "@pisto/billing";
import { createDatabase, parseDatabaseConfig } from "@pisto/db";

import { createApp } from "./app.ts";
import { parseApiConfig } from "./config.ts";

export function createRuntime(env: Record<string, string | undefined>) {
  const config = parseApiConfig(env);
  const authConfig = parseAuthConfig(env);
  const billingConfig = parseBillingConfig(env);
  const database = createDatabase(parseDatabaseConfig(env));
  const billing = createBillingRuntime({ config: billingConfig, db: database.db });
  const auth = createAuth({ config: authConfig, db: database.db, billing });
  const app = createApp({
    config,
    authConfig,
    auth,
    billing,
    database,
  });

  return { app, auth, billing, database, config };
}
