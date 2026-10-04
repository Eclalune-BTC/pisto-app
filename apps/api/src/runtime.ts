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

export function createRuntime(env: Record<string, string | undefined>) {
  const config = parseApiConfig(env);
  const authConfig = parseAuthConfig(env);
  const billingConfig = parseBillingConfig(env);
  const database = createDatabase(parseDatabaseConfig(env));
  const billing = createBillingRuntime({ config: billingConfig, db: database.db });
  const auth = createAuth({ config: authConfig, db: database.db, billing });
  const app = createApp({
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

  return { app, auth, billing, database, config };
}
