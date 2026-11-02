import { Elysia } from "elysia";
import type { ApiConfig } from "../config.ts";
import { ApiError } from "../errors.ts";

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
// Elysia never parses a GET or HEAD body, so those requests are not buffered.
const bodylessMethods = new Set(["GET", "HEAD", "OPTIONS"]);

const tooLarge = () =>
  new ApiError(413, "BAD_REQUEST", "Request body exceeds the configured limit");

/**
 * A POST path that takes a raw binary body instead of JSON. A non-JSON media type is still not
 * CORS-simple, so a cross-origin browser must preflight; the path additionally requires a present,
 * allowlisted Origin because no native client uploads to it.
 */
export interface RawBodyRoute {
  path: string;
  mediaTypes: readonly string[];
  limitBytes: number;
}

function rawBodyRoute(
  routes: readonly RawBodyRoute[],
  request: Request,
  path: string,
): RawBodyRoute | undefined {
  return request.method === "POST" ? routes.find((route) => route.path === path) : undefined;
}

function mediaTypeOf(request: Request): string | undefined {
  return request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
}

/** Header-only checks that are cheap enough to run before authentication. */
export function requestPolicy(config: ApiConfig, rawBodyRoutes: readonly RawBodyRoute[] = []) {
  return new Elysia({ name: "pisto.request-policy" })
    .onRequest((context) => {
      Object.assign(context.set.headers, secureHeaders);
      const path = new URL(context.request.url).pathname;
      const versionedPath = path === "/v1" || path.startsWith("/v1/");
      if (versionedPath) context.set.headers["Cache-Control"] = "no-store";
      if (context.request.method === "OPTIONS") return;
      const raw = rawBodyRoute(rawBodyRoutes, context.request, path);
      const limit = raw?.limitBytes ?? config.requestBodyLimitBytes;
      if (Number(context.request.headers.get("content-length")) > limit) {
        throw tooLarge();
      }
      if (versionedPath && unsafeMethods.has(context.request.method)) {
        const origin = context.request.headers.get("origin");
        if (origin && !config.corsOrigins.includes(origin)) {
          throw new ApiError(403, "FORBIDDEN", "Request origin is not allowed");
        }
        const mediaType = mediaTypeOf(context.request);
        if (raw) {
          if (!origin) throw new ApiError(403, "FORBIDDEN", "Request origin is required");
          if (!mediaType || !raw.mediaTypes.includes(mediaType)) {
            throw new ApiError(415, "BAD_REQUEST", "This audio format is not accepted");
          }
          return;
        }
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

/**
 * Buffers a request body up to the limit, covering streams without a Content-Length. Register it
 * after `productAccess` so an anonymous or rate-limited business request is rejected unread.
 */
export function requestBodyLimit(
  defaultLimit: number,
  rawBodyRoutes: readonly RawBodyRoute[] = [],
) {
  return new Elysia({ name: "pisto.request-body-limit" })
    .onRequest(async (context) => {
      const { request } = context;
      if (bodylessMethods.has(request.method) || !request.body) return;
      const raw = rawBodyRoute(rawBodyRoutes, request, new URL(request.url).pathname);
      const limit = raw?.limitBytes ?? defaultLimit;
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
      context.request = new Request(request, { body: Buffer.concat(chunks, size) });
    })
    .as("global");
}
