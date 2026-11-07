import { execSync } from "node:child_process";
import { serverEnv } from "./environment.ts";

export default function globalSetup() {
  const env = { ...process.env, ...serverEnv };
  for (const command of ["bun run --filter @pisto/db db:migrate", "bun run scripts/seed.ts"]) {
    execSync(command, { env, stdio: "inherit" });
  }
}
