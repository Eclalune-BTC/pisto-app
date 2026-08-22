import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import type { DatabaseHandle } from "@pisto/db";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import type { ApiConfig } from "./config.ts";
import { ApiError } from "./errors.ts";
import { requestContext } from "./middleware/request-context.ts";
import { systemRoutes } from "./routes/system.ts";
import { v1Routes } from "./routes/v1.ts";
import type { AppEnv } from "./types.ts";

export function createApp(input: {
  config: ApiConfig;
  authConfig: { baseUrl: string };
  auth: Auth;
  billing: BillingRuntime;
  database: DatabaseHandle;
}) {
  const app = new Hono<AppEnv>();

  app.use("*", requestContext());
  app.use(
    "*",
    cors({
      origin: input.config.corsOrigins,
      credentials: true,
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-RevenueCat-Webhook-Signature",
      ],
      exposeHeaders: ["X-Request-ID"],
      maxAge: 600,
    }),
  );
  app.use("*", secureHeaders());
  app.use(
    "*",
    bodyLimit({
      maxSize: input.config.requestBodyLimitBytes,
      onError: () => {
        throw new ApiError(413, "BAD_REQUEST", "Request body exceeds the configured limit");
      },
    }),
  );

  app.route("/", systemRoutes({ database: input.database, billing: input.billing }));

  const authHandler = (context: { req: { raw: Request } }) => input.auth.handler(context.req.raw);
  const providerBillingRouteGuard = () => {
    throw new ApiError(404, "NOT_FOUND", "Route not found");
  };

  // Provider checkout and customer APIs bypass the application's catalog and
  // organization checks. The /v1 billing routes call the adapter internally
  // after applying those checks; only the verified webhook remains public.
  app.on(["GET", "POST"], "/api/auth/checkout", providerBillingRouteGuard);
  app.on(["GET", "POST"], "/api/auth/checkout/*", providerBillingRouteGuard);
  app.on(["GET", "POST"], "/api/auth/customer", providerBillingRouteGuard);
  app.on(["GET", "POST"], "/api/auth/customer/*", providerBillingRouteGuard);
  app.on(["GET", "POST"], "/api/auth", authHandler);
  app.on(["GET", "POST"], "/api/auth/*", authHandler);

  app.route(
    "/v1",
    v1Routes({
      auth: input.auth,
      authBaseUrl: input.authConfig.baseUrl,
      billing: input.billing,
      db: input.database.db,
    }),
  );

  app.notFound((context) =>
    context.json(
      {
        error: {
          code: "NOT_FOUND" as const,
          message: "Route not found",
          requestId: context.get("requestId"),
        },
      },
      404,
    ),
  );

  app.onError((error, context) => {
    const requestId = context.get("requestId") || crypto.randomUUID();
    const apiError =
      error instanceof ApiError
        ? error
        : new ApiError(500, "INTERNAL_ERROR", "An unexpected error occurred");
    if (!(error instanceof ApiError)) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Unhandled request error",
          requestId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    return context.json(
      {
        error: {
          code: apiError.code,
          message: apiError.message,
          requestId,
          ...(apiError.details !== undefined ? { details: apiError.details } : {}),
        },
      },
      apiError.status,
    );
  });

  return app;
}
