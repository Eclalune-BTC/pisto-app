import { env } from "cloudflare:workers";
import type { RealtimeServerMessage } from "@pisto/contracts";
import { CloudflareAdapter } from "elysia/adapter/cloudflare-worker";
import { z } from "zod";

import { isRealtimeUpgrade } from "./realtime.ts";
import { createRuntime } from "./runtime.ts";

// The few Workers runtime shapes this entry uses; wrangler supplies the implementations.
interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}
interface DurableObjectNamespace {
  idFromName(name: string): unknown;
  get(id: unknown, options?: { locationHint?: string }): DurableObjectStub;
}
interface WorkerEnv {
  API: DurableObjectNamespace;
}
interface WorkerSocket {
  accept(): void;
  send(message: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  addEventListener(type: "close" | "error", listener: () => void): void;
}
declare const WebSocketPair: new () => { 0: WorkerSocket; 1: WorkerSocket };

// Workers allow generating code from strings only while the module starts. Zod would otherwise
// try it during a request, and every Elysia route is compiled here for the same reason.
z.config({ jitless: true });

/** Bindings that are objects (namespaces, assets) are not configuration. */
const configuration = Object.fromEntries(
  Object.entries(env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
);
const runtime = createRuntime(configuration, { adapter: CloudflareAdapter });
runtime.app.compile();

async function acceptRealtime(request: Request): Promise<Response> {
  const admission = await runtime.authorizeSocket(request);
  if (admission instanceof Response) return admission;
  const { 0: client, 1: server } = new WebSocketPair();
  server.accept();
  const unsubscribe = runtime.realtime.subscribe(admission.businessId, server);
  server.addEventListener("message", (event) => runtime.realtime.receive(server, event.data));
  server.addEventListener("close", unsubscribe);
  server.addEventListener("error", unsubscribe);
  server.send(
    JSON.stringify({
      type: "ready",
      businessId: admission.businessId,
    } satisfies RealtimeServerMessage),
  );
  return new Response(null, { status: 101, webSocket: client } as ResponseInit);
}

/**
 * One Durable Object instance runs the API. Unlike a stateless Worker request, a Durable Object
 * keeps one I/O context across requests, so the PostgreSQL pool opened on its first request and
 * every realtime socket are shared, the way they are in the Bun server.
 */
export class ApiServer {
  fetch(request: Request): Promise<Response> | Response {
    if (isRealtimeUpgrade(request)) return acceptRealtime(request);
    return runtime.app.fetch(request);
  }
}

export default {
  // Static assets answer every other path before this handler runs (see wrangler.jsonc).
  fetch(request: Request, workerEnv: WorkerEnv): Promise<Response> {
    // The database is in AWS us-east-1; eastern North America keeps each query round trip short.
    const api = workerEnv.API.get(workerEnv.API.idFromName("api"), { locationHint: "enam" });
    return api.fetch(request);
  },
};
