import { readEnvironment } from "@pisto/config";

import type { DatabaseConfig } from "./client.ts";

export class DatabaseConfigurationError extends Error {
  override readonly name = "DatabaseConfigurationError";
}

const poolDefaults = {
  maxConnections: 10,
  connectTimeoutSeconds: 10,
  idleTimeoutSeconds: 20,
} as const;

export function parseDatabaseConfig(env: Record<string, string | undefined>): DatabaseConfig {
  const read = readEnvironment(env, DatabaseConfigurationError);
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
    maxConnections: read.integer("DATABASE_MAX_CONNECTIONS", poolDefaults.maxConnections, {
      min: 1,
      max: 100,
    }),
    connectTimeoutSeconds: read.integer(
      "DATABASE_CONNECT_TIMEOUT_SECONDS",
      poolDefaults.connectTimeoutSeconds,
      { min: 1, max: 60 },
    ),
    idleTimeoutSeconds: read.integer(
      "DATABASE_IDLE_TIMEOUT_SECONDS",
      poolDefaults.idleTimeoutSeconds,
      { min: 1, max: 600 },
    ),
    ...(sslValue ? { ssl: sslValue as (typeof allowedSslModes)[number] } : {}),
  };
}
