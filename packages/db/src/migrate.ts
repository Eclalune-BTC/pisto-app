import { fileURLToPath } from "node:url";

import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client.ts";
import { parseDatabaseConfig } from "./env.ts";

const config = parseDatabaseConfig(process.env);

const handle = createDatabase({
  ...config,
  maxConnections: 1,
});

try {
  await migrate(handle.db, {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  console.info(JSON.stringify({ level: "info", message: "Migrations applied" }));
} finally {
  await handle.close();
}
