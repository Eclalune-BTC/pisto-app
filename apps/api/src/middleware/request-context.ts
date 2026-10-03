import { Elysia } from "elysia";

const trustedRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestContext() {
  return new Elysia({ name: "pisto.request-context" })
    .decorate("requestId", "")
    .decorate("startedAt", 0)
    .onRequest((context) => {
      const supplied = context.request.headers.get("x-request-id");
      context.requestId =
        supplied && trustedRequestId.test(supplied) ? supplied : crypto.randomUUID();
      context.startedAt = performance.now();
      context.set.headers["x-request-id"] = context.requestId;
    })
    .onAfterResponse(({ request, requestId, startedAt, route, set, response }) => {
      console.info(
        JSON.stringify({
          level: "info",
          message: "Request completed",
          requestId,
          method: request.method,
          // Never fall back to a raw URL: it can contain identifiers or tokens.
          path: route ?? "unmatched",
          status: response instanceof Response ? response.status : set.status,
          durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
        }),
      );
    })
    .as("global");
}
