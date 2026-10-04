import { type Environment, readEnvironment } from "@pisto/config";

export interface ApiConfig {
  host: string;
  port: number;
  corsOrigins: string[];
  requestBodyLimitBytes: number;
  production: boolean;
  productWritesEnabled: boolean;
  productReadLimit: number;
  productWriteLimit: number;
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
  };
}
