import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { schema } from "./schema/index.ts";

export type Database = PostgresJsDatabase<typeof schema>;

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  connectTimeoutSeconds?: number;
  idleTimeoutSeconds?: number;
  ssl?: "disable" | "prefer" | "require" | "verify-full";
}

export interface DatabaseHandle {
  db: Database;
  client: Sql;
  ping: () => Promise<void>;
  close: () => Promise<void>;
}

export function createDatabase(config: DatabaseConfig): DatabaseHandle {
  const client = postgres(config.url, {
    max: config.maxConnections ?? 10,
    connect_timeout: config.connectTimeoutSeconds ?? 10,
    idle_timeout: config.idleTimeoutSeconds ?? 20,
    ...(config.ssl && config.ssl !== "disable" ? { ssl: config.ssl } : {}),
  });
  const db = drizzle(client, { schema });

  return {
    db,
    client,
    async ping() {
      await client`select 1`;
    },
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}
