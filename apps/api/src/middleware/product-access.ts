import type { Auth } from "@pisto/auth";
import type { ConsumeProductRequest, ProductActor } from "@pisto/db";
import { Elysia } from "elysia";
import { ApiError } from "../errors.ts";
import { requireSession, toProductActor } from "../session.ts";

const separatePolicyPaths = new Set(["/v1", "/v1/", "/v1/me", "/v1/webhooks/revenuecat"]);

export function productAccess(input: {
  auth: Auth;
  writesEnabled: boolean;
  consume: ConsumeProductRequest;
}) {
  return new Elysia({ name: "pisto.product-access" })
    .decorate("actor", null as ProductActor | null)
    .onRequest(async (context) => {
      const path = new URL(context.request.url).pathname;
      if (
        context.request.method === "OPTIONS" ||
        !path.startsWith("/v1/") ||
        separatePolicyPaths.has(path) ||
        path === "/v1/billing" ||
        path.startsWith("/v1/billing/")
      )
        return;
      // Authenticate and charge the request before parsing its body. The actor
      // lives in this request's context; repositories still authorize in SQL.
      const session = await requireSession(input.auth, context.request.headers);
      context.actor = toProductActor(session);
      const write = !["GET", "HEAD", "OPTIONS"].includes(context.request.method);
      if (write && !input.writesEnabled) {
        throw new ApiError(503, "WRITES_PAUSED", "Business changes are temporarily paused");
      }
      const result = await input.consume({ userId: session.user.id, write });
      if (!result.allowed) {
        context.set.headers["Retry-After"] = String(result.retryAfterSeconds);
        throw new ApiError(
          429,
          "RATE_LIMITED",
          "Too many requests; try again after the indicated delay",
        );
      }
    })
    .as("global");
}

export type ProductAccess = ReturnType<typeof productAccess>;
