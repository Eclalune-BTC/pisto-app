import { type Environment, type EnvironmentReader, readEnvironment } from "@pisto/config";

export interface ApiConfig {
  host: string;
  port: number;
  corsOrigins: string[];
  requestBodyLimitBytes: number;
  production: boolean;
  productWritesEnabled: boolean;
  productReadLimit: number;
  productWriteLimit: number;
  assistant: AssistantConfig;
}

export interface AssistantConfig {
  /** Null when unset: the assistant is on exactly when a model provider is available. */
  enabled: boolean | null;
  /** Workers AI REST credentials for the local Bun API; the Worker uses its AI binding. */
  rest: { accountId: string; apiToken: string } | null;
  interpretLimit: number;
  transcribeLimit: number;
  businessLimit: number;
  audioLimitBytes: number;
}

export class ApiConfigurationError extends Error {
  override readonly name = "ApiConfigurationError";
}

export function parseApiConfig(env: Environment): ApiConfig {
  const read = readEnvironment(env, ApiConfigurationError);
  return {
    // Container platforms such as Cloud Run inject PORT; API_PORT is the local setting.
    host: read.optional("API_HOST") ?? "0.0.0.0",
    port: read.integer(read.optional("PORT") ? "PORT" : "API_PORT", 3001, { min: 1, max: 65_535 }),
    corsOrigins: read.originList("CORS_ORIGINS"),
    requestBodyLimitBytes: read.integer("API_REQUEST_BODY_LIMIT_BYTES", 1_048_576, {
      min: 1_024,
      max: 10_485_760,
    }),
    production: read.production,
    productWritesEnabled: read.boolean("PRODUCT_WRITES_ENABLED", true),
    productReadLimit: read.integer("PRODUCT_READ_LIMIT_PER_MINUTE", 300, { min: 1, max: 10_000 }),
    productWriteLimit: read.integer("PRODUCT_WRITE_LIMIT_PER_MINUTE", 60, { min: 1, max: 1_000 }),
    assistant: parseAssistantConfig(read),
  };
}

function parseAssistantConfig(read: EnvironmentReader): AssistantConfig {
  const accountId = read.optional("CLOUDFLARE_ACCOUNT_ID");
  const apiToken = read.optional("CLOUDFLARE_AI_API_TOKEN");
  if (Boolean(accountId) !== Boolean(apiToken)) {
    read.fail("CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_AI_API_TOKEN must be set together");
  }
  return {
    enabled:
      read.optional("ASSISTANT_ENABLED") === undefined
        ? null
        : read.boolean("ASSISTANT_ENABLED", false),
    rest: accountId && apiToken ? { accountId, apiToken } : null,
    interpretLimit: read.integer("ASSISTANT_INTERPRET_LIMIT_PER_MINUTE", 20, { min: 1, max: 600 }),
    transcribeLimit: read.integer("ASSISTANT_TRANSCRIBE_LIMIT_PER_MINUTE", 10, {
      min: 1,
      max: 600,
    }),
    businessLimit: read.integer("ASSISTANT_BUSINESS_LIMIT_PER_MINUTE", 60, { min: 1, max: 3_000 }),
    // 16 kHz mono 16-bit WAV is 32 000 bytes per second: about 50 seconds of speech.
    audioLimitBytes: read.integer("ASSISTANT_AUDIO_LIMIT_BYTES", 1_600_000, {
      min: 65_536,
      max: 5_242_880,
    }),
  };
}
