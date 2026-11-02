import { createAuth, parseAuthConfig } from "@pisto/auth";
import { createBillingRuntime, parseBillingConfig } from "@pisto/billing";
import {
  createBusinessRepository,
  createCashRepository,
  createCatalogRepository,
  createDatabase,
  createProductRateLimiter,
  createReceivablesRepository,
  createReportsRepository,
  createSalesRepository,
  parseDatabaseConfig,
} from "@pisto/db";

import { createApp } from "./app.ts";
import { parseApiConfig } from "./config.ts";
import { authorizeRealtime, RealtimeHub } from "./realtime.ts";

export function createRuntime(
  env: Record<string, string | undefined>,
  options: Pick<Parameters<typeof createApp>[0], "adapter"> = {},
) {
  const config = parseApiConfig(env);
  const authConfig = parseAuthConfig(env);
  const billingConfig = parseBillingConfig(env);
  const database = createDatabase(parseDatabaseConfig(env));
  const billing = createBillingRuntime({ config: billingConfig, db: database.db });
  const auth = createAuth({ config: authConfig, db: database.db, billing });
  const realtime = new RealtimeHub();
  const app = createApp({
    ...options,
    realtime,
    config,
    authBaseUrl: authConfig.baseUrl,
    auth,
    billing,
    database,
    repositories: {
      businesses: createBusinessRepository(database.db),
      cash: createCashRepository(database.db),
      catalog: createCatalogRepository(database.db),
      receivables: createReceivablesRepository(database.db),
      reports: createReportsRepository(database.db),
      sales: createSalesRepository(database.db),
    },
    consumeProductRequest: createProductRateLimiter(database.db, {
      readLimit: config.productReadLimit,
      writeLimit: config.productWriteLimit,
      windowSeconds: 60,
    }),
  });

  const authorizeSocket = (request: Request) =>
    authorizeRealtime({ auth, db: database.db, corsOrigins: config.corsOrigins, request });

  return { app, auth, billing, database, config, realtime, authorizeSocket };
}
