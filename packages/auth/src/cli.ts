import { createBillingRuntime, parseBillingConfig } from "@pisto/billing";
import { createDatabase, parseDatabaseConfig } from "@pisto/db";

import { createAuth } from "./create-auth.ts";
import { parseAuthConfig } from "./env.ts";

const database = createDatabase(parseDatabaseConfig(process.env));
const billing = createBillingRuntime({
  config: parseBillingConfig(process.env),
  db: database.db,
});

export const auth = createAuth({
  config: parseAuthConfig(process.env),
  db: database.db,
  billing,
});
