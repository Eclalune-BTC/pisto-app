import { z } from "zod";

export interface ApiConfig {
  host: string;
  port: number;
  corsOrigins: string[];
  requestBodyLimitBytes: number;
  production: boolean;
}

export class ApiConfigurationError extends Error {
  override readonly name = "ApiConfigurationError";
}

function isReservedProductionHostname(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0") return true;
  if (/^127(?:\.\d{1,3}){3}$/.test(normalized)) return true;
  return [
    "localhost",
    "test",
    "invalid",
    "example",
    "example.com",
    "example.net",
    "example.org",
  ].some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

function parseCorsOrigins(value: string | undefined, production: boolean): string[] {
  if (!value?.trim()) return [];
  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  for (const origin of origins) {
    const parsed = z.string().url().safeParse(origin);
    const url = parsed.success ? new URL(origin) : null;
    if (
      !url ||
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== origin ||
      (production && url.protocol !== "https:")
    ) {
      throw new ApiConfigurationError(
        production
          ? "Production CORS_ORIGINS must contain exact HTTPS origins"
          : "CORS_ORIGINS must contain exact HTTP(S) origins without paths",
      );
    }
    if (production && isReservedProductionHostname(url.hostname)) {
      throw new ApiConfigurationError(
        "Production CORS_ORIGINS cannot contain reserved or example hostnames",
      );
    }
  }
  return [...new Set(origins)];
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  variable: string,
  min: number,
  max: number,
) {
  if (!value?.trim()) return fallback;
  const result = z.coerce.number().int().min(min).max(max).safeParse(value);
  if (!result.success) {
    throw new ApiConfigurationError(`${variable} must be an integer from ${min} to ${max}`);
  }
  return result.data;
}

export function parseApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const production = (env.NODE_ENV ?? "development") === "production";
  return {
    host: env.API_HOST?.trim() || "0.0.0.0",
    port: parseInteger(env.PORT ?? env.API_PORT, 3001, "PORT", 1, 65_535),
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS, production),
    requestBodyLimitBytes: parseInteger(
      env.API_REQUEST_BODY_LIMIT_BYTES,
      1_048_576,
      "API_REQUEST_BODY_LIMIT_BYTES",
      1_024,
      10_485_760,
    ),
    production,
  };
}
