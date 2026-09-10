import { createRuntime } from "../apps/api/src/runtime.ts";

// Hosting entrypoint only. Docker uses apps/api/src/index.ts; domain code is shared.
const runtime = createRuntime(process.env);
Bun.serve({ fetch: runtime.app.fetch });
