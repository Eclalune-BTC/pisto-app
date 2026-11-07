import { randomBytes } from "node:crypto";

export const apiPort = 3101;
export const webPort = 8181;
export const apiOrigin = `http://127.0.0.1:${apiPort}`;
export const webOrigin = `http://127.0.0.1:${webPort}`;
export const webExportDir = ".cache/e2e-web";

// biome-ignore lint/suspicious/noUndeclaredEnvVars: Playwright reads it directly; no Turborepo task depends on it.
const databaseUrl = process.env.E2E_DATABASE_URL;
if (!databaseUrl) {
  throw new Error("E2E_DATABASE_URL is required: point it at a disposable PostgreSQL database");
}
// The suite migrates, seeds and writes records; refuse anything that is not an explicit test database.
if (!new URL(databaseUrl).pathname.endsWith("_e2e")) {
  throw new Error("E2E_DATABASE_URL must name a database ending in _e2e");
}

/** Server environment shared by the API under test and the seed that prepares its database. */
export const serverEnv: Record<string, string> = {
  NODE_ENV: "development",
  API_HOST: "127.0.0.1",
  API_PORT: String(apiPort),
  DATABASE_URL: databaseUrl,
  DATABASE_SSL: "disable",
  BETTER_AUTH_SECRET: randomBytes(32).toString("base64url"),
  BETTER_AUTH_URL: apiOrigin,
  CORS_ORIGINS: webOrigin,
  TRUSTED_ORIGINS: webOrigin,
  EXPO_SCHEME: "pisto",
  AUTH_EMAIL_PASSWORD_ENABLED: "true",
  AUTH_TRUSTED_PROXY_HEADERS: "false",
  BILLING_ENABLED: "false",
  REVENUECAT_ENABLED: "false",
};

export const demoPassword = "PistoDemo2026";
export const accounts = {
  owner: "dueno@pisto.test",
  seller: "vendedor@pisto.test",
} as const;
