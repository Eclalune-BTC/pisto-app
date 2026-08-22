import { createRuntime } from "./runtime.ts";

const runtime = createRuntime(process.env);
const shutdownTimeoutMs = 9_000;
const gracefulHttpTimeoutMs = 6_000;

export const server = Bun.serve({
  hostname: runtime.config.host,
  port: runtime.config.port,
  fetch: runtime.app.fetch,
});

console.info(
  JSON.stringify({
    level: "info",
    message: "Pisto API listening",
    host: server.hostname,
    port: server.port,
    polarBilling: runtime.billing.config.polar.enabled ? "enabled" : "disabled",
    revenueCat: runtime.billing.config.revenueCat.enabled ? "enabled" : "disabled",
  }),
);

function waitBeforeDeadline(
  operation: Promise<unknown>,
  deadline: number,
): Promise<"completed" | "timed_out"> {
  const remaining = Math.max(0, deadline - Date.now());
  return Promise.race([
    operation.then(() => "completed" as const),
    new Promise<"timed_out">((resolve) => {
      setTimeout(() => resolve("timed_out"), remaining);
    }),
  ]);
}

let shutdownPromise: Promise<boolean> | null = null;

export function shutdown(signal: "SIGINT" | "SIGTERM"): Promise<boolean> {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    const deadline = Date.now() + shutdownTimeoutMs;
    const httpDeadline = Date.now() + gracefulHttpTimeoutMs;
    let clean = true;
    console.info(
      JSON.stringify({
        level: "info",
        message: "API shutdown started",
        signal,
        deadlineMs: shutdownTimeoutMs,
      }),
    );

    try {
      const stopStatus = await waitBeforeDeadline(server.stop(false), httpDeadline);
      if (stopStatus === "timed_out") {
        clean = false;
        console.warn(
          JSON.stringify({
            level: "warn",
            message: "Graceful HTTP shutdown reached its deadline",
            signal,
          }),
        );
        await server.stop(true);
      }
    } catch (error) {
      clean = false;
      console.error(
        JSON.stringify({
          level: "error",
          message: "HTTP server shutdown failed",
          signal,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      await server.stop(true).catch(() => undefined);
    }

    try {
      const databaseStatus = await waitBeforeDeadline(runtime.database.close(), deadline);
      if (databaseStatus === "timed_out") {
        clean = false;
        console.warn(
          JSON.stringify({
            level: "warn",
            message: "Database shutdown reached its deadline",
            signal,
          }),
        );
      }
    } catch (error) {
      clean = false;
      console.error(
        JSON.stringify({
          level: "error",
          message: "Database shutdown failed",
          signal,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }

    console.info(
      JSON.stringify({
        level: "info",
        message: "API shutdown finished",
        signal,
        clean,
      }),
    );
    return clean;
  })();
  return shutdownPromise;
}

function terminate(signal: "SIGINT" | "SIGTERM") {
  void shutdown(signal).then(
    (clean) => process.exit(clean ? 0 : 1),
    (error) => {
      console.error(
        JSON.stringify({
          level: "error",
          message: "API shutdown crashed",
          signal,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      process.exit(1);
    },
  );
}

process.once("SIGTERM", () => terminate("SIGTERM"));
process.once("SIGINT", () => terminate("SIGINT"));
