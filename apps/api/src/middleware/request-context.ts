import type { MiddlewareHandler } from "hono";
import { routePath } from "hono/route";

import type { AppEnv } from "../types.ts";

const trustedRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestContext(): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    const supplied = context.req.header("x-request-id");
    const requestId = supplied && trustedRequestId.test(supplied) ? supplied : crypto.randomUUID();
    context.set("requestId", requestId);
    context.header("x-request-id", requestId);
    const startedAt = performance.now();

    await next();

    console.info(
      JSON.stringify({
        level: "info",
        message: "Request completed",
        requestId,
        method: context.req.method,
        // Patterns keep record IDs, auth tokens, and unknown user input out of logs.
        path: routePath(context, -1) ?? "unmatched",
        status: context.res.status,
        durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
      }),
    );
  };
}
