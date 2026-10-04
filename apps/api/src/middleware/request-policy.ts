import { Elysia } from "elysia";
import type { ApiConfig } from "../config.ts";
import { ApiError } from "../errors.ts";

// Preserve the API's existing security policy independently of the HTTP router.
const secureHeaders = {
  "cross-origin-resource-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "origin-agent-cluster": "?1",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=15552000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-dns-prefetch-control": "off",
  "x-download-options": "noopen",
  "x-frame-options": "SAMEORIGIN",
  "x-permitted-cross-domain-policies": "none",
  "x-xss-protection": "0",
};
const unsafeMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);

async function boundedRequest(request: Request, limit: number): Promise<Request> {
  const tooLarge = () =>
    new ApiError(413, "BAD_REQUEST", "Request body exceeds the configured limit");
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  if (!request.body) return request;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        void reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new Request(request, { body: Buffer.concat(chunks, size) });
}

export function requestPolicy(config: ApiConfig) {
  return new Elysia({ name: "pisto.request-policy" })
    .onRequest(async (context) => {
      Object.assign(context.set.headers, secureHeaders);
      const path = new URL(context.request.url).pathname;
      const productPath = path === "/v1" || path.startsWith("/v1/");
      if (productPath) context.set.headers["Cache-Control"] = "no-store";
      if (context.request.method === "OPTIONS") return;
      context.request = await boundedRequest(context.request, config.requestBodyLimitBytes);
      if (productPath && unsafeMethods.has(context.request.method)) {
        const origin = context.request.headers.get("origin");
        if (origin && !config.corsOrigins.includes(origin)) {
          throw new ApiError(403, "FORBIDDEN", "Request origin is not allowed");
        }
        const mediaType = context.request.headers
          .get("content-type")
          ?.split(";", 1)[0]
          ?.trim()
          .toLowerCase();
        if (mediaType !== "application/json") {
          throw new ApiError(415, "BAD_REQUEST", "A JSON request body is required");
        }
      }
    })
    .onAfterHandle(({ response }) => {
      if (!(response instanceof Response)) return;
      // Provider responses must not weaken the application's response policy.
      const secured = new Response(response.body, response);
      for (const [name, value] of Object.entries(secureHeaders)) secured.headers.set(name, value);
      secured.headers.delete("x-powered-by");
      return secured;
    })
    .as("global");
}
