import type { DatabaseConfig } from "./client.ts";

export class DatabaseConfigurationError extends Error {
  override readonly name = "DatabaseConfigurationError";
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  variable: string,
  range: { min: number; max: number },
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < range.min || parsed > range.max) {
    throw new DatabaseConfigurationError(
      `${variable} must be an integer from ${range.min} to ${range.max}`,
    );
  }
  return parsed;
}

export function parseDatabaseConfig(env: Record<string, string | undefined>): DatabaseConfig {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new DatabaseConfigurationError("DATABASE_URL is required");
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new DatabaseConfigurationError("DATABASE_URL must be a valid URL");
  }
  if (parsedUrl.protocol !== "postgres:" && parsedUrl.protocol !== "postgresql:") {
    throw new DatabaseConfigurationError(
      "DATABASE_URL must use the postgres or postgresql protocol",
    );
  }

  const sslValue = env.DATABASE_SSL?.trim();
  const allowedSslModes = ["disable", "prefer", "require", "verify-full"] as const;
  if (sslValue && !allowedSslModes.includes(sslValue as (typeof allowedSslModes)[number])) {
    throw new DatabaseConfigurationError(
      "DATABASE_SSL must be disable, prefer, require, or verify-full",
    );
  }

  return {
    url,
    maxConnections: parseInteger(env.DATABASE_MAX_CONNECTIONS, 10, "DATABASE_MAX_CONNECTIONS", {
      min: 1,
      max: 100,
    }),
    connectTimeoutSeconds: parseInteger(
      env.DATABASE_CONNECT_TIMEOUT_SECONDS,
      10,
      "DATABASE_CONNECT_TIMEOUT_SECONDS",
      { min: 1, max: 60 },
    ),
    idleTimeoutSeconds: parseInteger(
      env.DATABASE_IDLE_TIMEOUT_SECONDS,
      20,
      "DATABASE_IDLE_TIMEOUT_SECONDS",
      { min: 1, max: 600 },
    ),
    ...(sslValue ? { ssl: sslValue as (typeof allowedSslModes)[number] } : {}),
  };
}
