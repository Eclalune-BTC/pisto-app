import type { Auth } from "@pisto/auth";
import type { ConsumeProductRequest } from "@pisto/db";
import type { MiddlewareHandler } from "hono";
import { ApiError } from "../errors.ts";
import { requireSession } from "../session.ts";
import type { AppEnv } from "../types.ts";

const separatePolicyPaths = new Set(["/v1", "/v1/", "/v1/me", "/v1/webhooks/revenuecat"]);

export function productAccess(input: {
  auth: Auth;
  writesEnabled: boolean;
  consume: ConsumeProductRequest;
}): MiddlewareHandler<AppEnv> {
  return async (context, next) => {
    // New business routes inherit the guard. Only existing account/provider
    // endpoints, which have their own policy, are exempt.
    const path = context.req.path;
    if (separatePolicyPaths.has(path) || path === "/v1/billing" || path.startsWith("/v1/billing/"))
      return next();
    const session = await requireSession(input.auth, context.req.raw.headers);
    const write = !["GET", "HEAD", "OPTIONS"].includes(context.req.method);
    if (write && !input.writesEnabled) {
      throw new ApiError(503, "WRITES_PAUSED", "Business changes are temporarily paused");
    }
    const result = await input.consume({ userId: session.user.id, write });
    if (!result.allowed) {
      context.header("Retry-After", String(result.retryAfterSeconds));
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Too many requests; try again after the indicated delay",
      );
    }
    await next();
  };
}
