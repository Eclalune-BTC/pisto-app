import type { RealtimeServerMessage } from "@pisto/contracts";

import { isRealtimeUpgrade } from "./realtime.ts";
import { createRuntime } from "./runtime.ts";

const runtime = createRuntime(process.env);
const shutdownTimeoutMs = 9_000;
const gracefulHttpTimeoutMs = 6_000;

interface SocketData {
  businessId: string;
  unsubscribe?: () => void;
}

export const server = Bun.serve<SocketData>({
  hostname: runtime.config.host,
  port: runtime.config.port,
  async fetch(request, bunServer) {
    if (!isRealtimeUpgrade(request)) return runtime.app.fetch(request);
    const admission = await runtime.authorizeSocket(request);
    if (admission instanceof Response) return admission;
    if (bunServer.upgrade(request, { data: { businessId: admission.businessId } })) return;
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "A WebSocket upgrade is required" } },
      { status: 400 },
    );
  },
  websocket: {
    open(socket) {
      socket.data.unsubscribe = runtime.realtime.subscribe(socket.data.businessId, socket);
      socket.send(
        JSON.stringify({
          type: "ready",
          businessId: socket.data.businessId,
        } satisfies RealtimeServerMessage),
      );
    },
    message(socket, message) {
      runtime.realtime.receive(socket, typeof message === "string" ? message : null);
    },
    close(socket) {
      socket.data.unsubscribe?.();
    },
  },
});

console.info(
  JSON.stringify({
    level: "info",
    message: "Pisto API listening",
    host: server.hostname,
    port: server.port,
    polarBilling: runtime.billing.checkoutEnabled ? "enabled" : "disabled",
    revenueCat: runtime.billing.revenueCatEnabled ? "enabled" : "disabled",
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
          errorType: error instanceof Error ? error.name : typeof error,
        }),
      );
      await server.stop(true).catch(() => {
        console.error(
          JSON.stringify({ level: "error", message: "Forced HTTP shutdown failed", signal }),
        );
      });
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
          errorType: error instanceof Error ? error.name : typeof error,
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
          errorType: error instanceof Error ? error.name : typeof error,
        }),
      );
      process.exit(1);
    },
  );
}

process.once("SIGTERM", () => terminate("SIGTERM"));
process.once("SIGINT", () => terminate("SIGINT"));
