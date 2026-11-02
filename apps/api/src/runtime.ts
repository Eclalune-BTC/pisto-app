import {
  type AssistantProvider,
  createWorkersAiBindingProvider,
  createWorkersAiRestProvider,
  emptySupplierDirectory,
  type WorkersAiBinding,
} from "@pisto/assistant";
import { createAuth, parseAuthConfig } from "@pisto/auth";
import { createBillingRuntime, parseBillingConfig } from "@pisto/billing";
import {
  createAssistantDirectory,
  createBusinessRepository,
  createCashRepository,
  createCatalogRepository,
  createDatabase,
  createProductRateLimiter,
  createRateLimitConsumer,
  createReceivablesRepository,
  createReportsRepository,
  createSalesRepository,
  parseDatabaseConfig,
} from "@pisto/db";

import { createApp } from "./app.ts";
import { type ApiConfig, ApiConfigurationError, parseApiConfig } from "./config.ts";
import { authorizeRealtime, RealtimeHub } from "./realtime.ts";

/**
 * The Worker passes its AI binding; the Bun API uses REST credentials when present. With neither,
 * or with ASSISTANT_ENABLED=false, the assistant reports itself as off; there is no fallback.
 */
export function assistantProvider(
  config: ApiConfig["assistant"],
  ai: WorkersAiBinding | undefined,
): AssistantProvider | null {
  if (config.enabled === false) return null;
  const provider = ai
    ? createWorkersAiBindingProvider(ai)
    : config.rest
      ? createWorkersAiRestProvider(config.rest)
      : null;
  if (config.enabled === true && !provider) {
    throw new ApiConfigurationError(
      "ASSISTANT_ENABLED=true requires the AI binding or CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN",
    );
  }
  return provider;
}

export function createRuntime(
  env: Record<string, string | undefined>,
  options: Pick<Parameters<typeof createApp>[0], "adapter"> & { ai?: WorkersAiBinding } = {},
) {
  const config = parseApiConfig(env);
  const authConfig = parseAuthConfig(env);
  const billingConfig = parseBillingConfig(env);
  const database = createDatabase(parseDatabaseConfig(env));
  const billing = createBillingRuntime({ config: billingConfig, db: database.db });
  const auth = createAuth({ config: authConfig, db: database.db, billing });
  const realtime = new RealtimeHub();
  const app = createApp({
    adapter: options.adapter,
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
    assistant: {
      provider: assistantProvider(config.assistant, options.ai),
      records: createAssistantDirectory(database.db),
      // The purchases module supplies the real supplier directory when it is composed.
      suppliers: emptySupplierDirectory,
      consume: createRateLimitConsumer(database.db),
      limits: {
        interpretPerMinute: config.assistant.interpretLimit,
        transcribePerMinute: config.assistant.transcribeLimit,
        businessPerMinute: config.assistant.businessLimit,
      },
      timeouts: { extractMs: 20_000, transcribeMs: 30_000 },
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
