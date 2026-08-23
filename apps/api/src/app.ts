import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import type {
  CashRepository,
  CatalogRepository,
  DatabaseHandle,
  ProductRepository,
  ReceivablesRepository,
} from "@pisto/db";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";

import type { ApiConfig } from "./config.ts";
import { ApiError, normalizeError } from "./errors.ts";
import { requestContext } from "./middleware/request-context.ts";
import { systemRoutes } from "./routes/system.ts";
import { v1Routes } from "./routes/v1.ts";
import type { AppEnv } from "./types.ts";

export function createApp(input: {
  config: ApiConfig;
  authConfig: { baseUrl: string };
  auth: Auth;
  billing: BillingRuntime;
  cash: CashRepository;
  catalog: CatalogRepository;
  database: DatabaseHandle;
  product: ProductRepository;
  receivables: ReceivablesRepository;
}) {
  const app = new Hono<AppEnv>();

  app.use("*", requestContext());
  app.use(
    "*",
    cors({
      origin: input.config.corsOrigins,
      credentials: true,
      allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
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

  const unsafeMethods = new Set(["POST", "PATCH", "PUT", "DELETE"]);

  app.use("/v1/*", async (context, next) => {
    // Every method that can mutate has to clear the same gate. CORS preflight
    // happens to block a cross-site PATCH from a browser, but docs/security.md
    // is explicit that CORS response headers are not the CSRF control.
    if (unsafeMethods.has(context.req.method)) {
      const origin = context.req.header("origin");
      if (origin && !input.config.corsOrigins.includes(origin)) {
        throw new ApiError(403, "FORBIDDEN", "Request origin is not allowed");
      }
      const contentType = context.req.header("content-type")?.toLowerCase() ?? "";
      if (!contentType.startsWith("application/json")) {
        throw new ApiError(415, "BAD_REQUEST", "A JSON request body is required");
      }
    }
    await next();
    context.header("Cache-Control", "no-store");
  });

  app.route("/", systemRoutes({ database: input.database, billing: input.billing }));

  const authHandler = (context: { req: { raw: Request } }) => input.auth.handler(context.req.raw);
  const providerBillingRouteGuard = () => {
    throw new ApiError(404, "NOT_FOUND", "Route not found");
  };

  const organizationMutationGuard = () => {
    throw new ApiError(404, "NOT_FOUND", "Route not found");
  };

  // Provider checkout and customer APIs bypass the application's catalog and
  // organization checks. The /v1 billing routes call the adapter internally
  // after applying those checks; only the verified webhook remains public.
  app.on(["GET", "POST"], "/api/auth/checkout", providerBillingRouteGuard);
  app.on(["GET", "POST"], "/api/auth/checkout/*", providerBillingRouteGuard);
  app.on(["GET", "POST"], "/api/auth/customer", providerBillingRouteGuard);
  app.on(["GET", "POST"], "/api/auth/customer/*", providerBillingRouteGuard);
  // Pisto owns business creation and keeps membership owner-only in Increment 1.
  // Better Auth remains the selector for the single server-created organization.
  app.on("POST", "/api/auth/organization/set-active", authHandler);
  app.on(["GET", "POST"], "/api/auth/organization", organizationMutationGuard);
  app.on(["GET", "POST"], "/api/auth/organization/*", organizationMutationGuard);
  app.on(["GET", "POST"], "/api/auth", authHandler);
  app.on(["GET", "POST"], "/api/auth/*", authHandler);

  app.route(
    "/v1",
    v1Routes({
      auth: input.auth,
      authBaseUrl: input.authConfig.baseUrl,
      billing: input.billing,
      cash: input.cash,
      catalog: input.catalog,
      db: input.database.db,
      product: input.product,
      receivables: input.receivables,
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

  // The single error boundary. Routes throw their domain failure and let it
  // travel here; they do not catch and re-map it, so one table decides every
  // public status, code, and message.
  app.onError((error, context) => {
    const requestId = context.get("requestId") || crypto.randomUUID();
    const { apiError, unexpected } = normalizeError(error);
    if (unexpected) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "Unhandled request error",
          requestId,
          errorType: error instanceof Error ? error.name : typeof error,
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
