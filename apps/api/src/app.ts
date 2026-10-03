import { cors } from "@elysiajs/cors";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import type {
  CashRepository,
  CatalogRepository,
  ConsumeProductRequest,
  DatabaseHandle,
  ProductRepository,
  ReceivablesRepository,
  ReportsRepository,
} from "@pisto/db";
import { Elysia } from "elysia";

import type { ApiConfig } from "./config.ts";
import { ApiError, normalizeError } from "./errors.ts";
import { productAccess } from "./middleware/product-access.ts";
import { requestContext } from "./middleware/request-context.ts";
import { requestPolicy } from "./middleware/request-policy.ts";
import { systemRoutes } from "./routes/system.ts";
import { v1Routes } from "./routes/v1.ts";

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
  reports: ReportsRepository;
  consumeProductRequest: ConsumeProductRequest;
}) {
  const access = productAccess({
    auth: input.auth,
    writesEnabled: input.config.productWritesEnabled,
    consume: input.consumeProductRequest,
  });
  const app = new Elysia({ strictPath: true })
    .use(requestContext())
    .use(
      cors({
        origin: (request) => input.config.corsOrigins.includes(request.headers.get("origin") ?? ""),
        credentials: true,
        // Route preflights normally so completion logging also covers OPTIONS.
        preflight: false,
        methods: ["GET", "POST", "PATCH", "OPTIONS"],
        allowedHeaders: [
          "Content-Type",
          "Authorization",
          "X-Request-ID",
          "X-RevenueCat-Webhook-Signature",
        ],
        exposeHeaders: ["X-Request-ID", "Retry-After"],
      }),
    )
    .use(requestPolicy(input.config))
    .use(access)
    .onError(({ error, set, requestId, request }) => {
      const { apiError, unexpected } = normalizeError(error);
      if (unexpected)
        console.error(
          JSON.stringify({
            level: "error",
            message: "Unhandled request error",
            requestId,
            errorType: error instanceof Error ? error.name : typeof error,
          }),
        );
      set.status = apiError.status;
      if (request.method === "HEAD") return new Response(null, { status: apiError.status });
      return {
        error: {
          code: apiError.code,
          message: apiError.message,
          requestId,
          ...(apiError.details !== undefined ? { details: apiError.details } : {}),
        },
      };
    });

  for (const path of ["/", "/*"]) {
    app.options(
      path,
      ({ set }) => {
        set.headers["access-control-max-age"] = "600";
        return new Response(null, { status: 204 });
      },
      { parse: "none" },
    );
  }

  const authHandler = ({ request }: { request: Request }) => input.auth.handler(request);
  const restrictedAuthRoute = () => {
    throw new ApiError(404, "NOT_FOUND", "Route not found");
  };
  // Pisto owns provider selection and business membership. Preserve exact guards
  // before mounting Better Auth, and never parse its signed bodies at this edge.
  for (const path of [
    "/api/auth/checkout",
    "/api/auth/checkout/*",
    "/api/auth/customer",
    "/api/auth/customer/*",
  ]) {
    for (const method of ["GET", "POST"] as const)
      app.route(method, path, restrictedAuthRoute, { parse: "none" });
  }
  app.post("/api/auth/organization/set-active", authHandler, { parse: "none" });
  for (const method of ["GET", "POST"] as const) {
    app.route(method, "/api/auth/organization", restrictedAuthRoute, { parse: "none" });
    app.route(method, "/api/auth/organization/*", restrictedAuthRoute, { parse: "none" });
    app.route(method, "/api/auth", authHandler, { parse: "none" });
    app.route(method, "/api/auth/*", authHandler, { parse: "none" });
  }
  app.use(systemRoutes({ database: input.database, billing: input.billing }));
  app.use(
    v1Routes({
      auth: input.auth,
      authBaseUrl: input.authConfig.baseUrl,
      access,
      billing: input.billing,
      cash: input.cash,
      catalog: input.catalog,
      db: input.database.db,
      product: input.product,
      receivables: input.receivables,
      reports: input.reports,
    }),
  );
  return app;
}
