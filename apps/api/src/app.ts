import { cors } from "@elysiajs/cors";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import type {
  BusinessRepository,
  CashRepository,
  CatalogRepository,
  ConsumeProductRequest,
  DatabaseHandle,
  ReceivablesRepository,
  ReportsRepository,
  SalesRepository,
} from "@pisto/db";
import { Elysia } from "elysia";

import type { ApiConfig } from "./config.ts";
import { ApiError, normalizeError } from "./errors.ts";
import { productAccess, sessionPolicyPaths } from "./middleware/product-access.ts";
import { requestContext } from "./middleware/request-context.ts";
import { requestBodyLimit, requestPolicy } from "./middleware/request-policy.ts";
import { billingRoutes } from "./routes/billing.ts";
import { businessRoutes } from "./routes/businesses.ts";
import { cashRoutes } from "./routes/cash.ts";
import { catalogRoutes } from "./routes/catalog.ts";
import { receivablesRoutes } from "./routes/receivables.ts";
import { reportsRoutes } from "./routes/reports.ts";
import { salesRoutes } from "./routes/sales.ts";
import { systemRoutes } from "./routes/system.ts";
import { v1Routes } from "./routes/v1.ts";

export interface ProductRepositories {
  businesses: BusinessRepository;
  cash: CashRepository;
  catalog: CatalogRepository;
  receivables: ReceivablesRepository;
  reports: ReportsRepository;
  sales: SalesRepository;
}

export function createApp(input: {
  config: ApiConfig;
  authBaseUrl: string;
  auth: Auth;
  billing: BillingRuntime;
  database: DatabaseHandle;
  repositories: ProductRepositories;
  consumeProductRequest: ConsumeProductRequest;
}) {
  // Routes under /v1 that own their session policy. Every other /v1 path is a business route.
  const sessionPolicyGroups = [
    v1Routes({ auth: input.auth }),
    billingRoutes({
      auth: input.auth,
      authBaseUrl: input.authBaseUrl,
      billing: input.billing,
      db: input.database.db,
    }),
  ];
  const access = productAccess({
    auth: input.auth,
    writesEnabled: input.config.productWritesEnabled,
    consume: input.consumeProductRequest,
    sessionPolicyPaths: sessionPolicyPaths(...sessionPolicyGroups),
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
    .use(requestBodyLimit(input.config.requestBodyLimitBytes))
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
  // Pisto owns provider selection and business membership, so these Better Auth endpoints are
  // hidden. Bodies are not parsed here because Better Auth verifies its own signed payloads.
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
  for (const group of sessionPolicyGroups) app.use(group);
  const { businesses, cash, catalog, receivables, reports, sales } = input.repositories;
  return app
    .use(businessRoutes({ access, businesses }))
    .use(salesRoutes({ access, sales }))
    .use(catalogRoutes({ access, catalog }))
    .use(cashRoutes({ access, cash }))
    .use(receivablesRoutes({ access, receivables }))
    .use(reportsRoutes({ access, reports }));
}
