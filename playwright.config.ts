import { defineConfig, devices } from "@playwright/test";
import { apiOrigin, serverEnv, webExportDir, webOrigin, webPort } from "./e2e/environment.ts";

const ci = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: webOrigin,
    locale: "es-SV",
    timezoneId: "America/El_Salvador",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
  webServer: [
    {
      command: "bun apps/api/src/index.ts",
      env: serverEnv,
      url: `${apiOrigin}/ready`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      // Export with --clear so Metro cannot embed an API origin cached from another build.
      command: `bun run --cwd apps/app export:web --output-dir ../../${webExportDir} --clear && bun scripts/serve-web.ts ${webExportDir} ${webPort}`,
      env: { EXPO_PUBLIC_API_URL: apiOrigin, EXPO_PUBLIC_APP_SCHEME: "pisto" },
      url: webOrigin,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
