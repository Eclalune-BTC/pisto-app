import { cors } from "@elysiajs/cors";
import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import type {
  BusinessRepository,
  CashRepository,
  CatalogRepository,
  ConsumeProductRequest,
  DatabaseHandle,
  DebtorsRepository,
  MoneyTrendRepository,
  MovementsRepository,
  PurchasesRepository,
  ReceivablesRepository,
  ReportsRepository,
  SalesRepository,
} from "@pisto/db";
import { Elysia, type ElysiaConfig } from "elysia";

import type { ApiConfig } from "./config.ts";
import { ApiError, normalizeError } from "./errors.ts";
import { productAccess, sessionPolicyPaths } from "./middleware/product-access.ts";
import { requestContext } from "./middleware/request-context.ts";
import { type RawBodyRoute, requestBodyLimit, requestPolicy } from "./middleware/request-policy.ts";
import { changedResource, type RealtimeHub } from "./realtime.ts";
import {
  type AssistantServices,
  assistantRoutes,
  transcriptionMediaTypes,
  transcriptionPath,
} from "./routes/assistant.ts";
import { billingRoutes } from "./routes/billing.ts";
import { businessRoutes } from "./routes/businesses.ts";
import { cashRoutes } from "./routes/cash.ts";
import { catalogRoutes } from "./routes/catalog.ts";
import { debtorsRoutes } from "./routes/debtors.ts";
import { moneyTrendRoutes } from "./routes/money-trend.ts";
import { movementsRoutes } from "./routes/movements.ts";
import { purchasesRoutes } from "./routes/purchases.ts";
import { receivablesRoutes } from "./routes/receivables.ts";
import { reportsRoutes } from "./routes/reports.ts";
import { salesRoutes } from "./routes/sales.ts";
import { systemRoutes } from "./routes/system.ts";
import { v1Routes } from "./routes/v1.ts";

export interface ProductRepositories {
  businesses: BusinessRepository;
  cash: CashRepository;
  catalog: CatalogRepository;
  purchases: PurchasesRepository;
  debtors: DebtorsRepository;
  moneyTrend: MoneyTrendRepository;
  movements: MovementsRepository;
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
  realtime: RealtimeHub;
  assistant: AssistantServices;
  /** Cloudflare Workers pass their adapter so `compile()` can prepare every route at startup. */
  adapter?: ElysiaConfig<"">["adapter"];
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
  const rawBodyRoutes: RawBodyRoute[] = [
    {
      path: transcriptionPath,
      mediaTypes: transcriptionMediaTypes,
      limitBytes: input.config.assistant.audioLimitBytes,
    },
  ];
  const access = productAccess({
    auth: input.auth,
    writesEnabled: input.config.productWritesEnabled,
    consume: input.consumeProductRequest,
    sessionPolicyPaths: sessionPolicyPaths(...sessionPolicyGroups),
  });
  const app = new Elysia({ strictPath: true, ...(input.adapter ? { adapter: input.adapter } : {}) })
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
    .use(requestPolicy(input.config, rawBodyRoutes))
    .use(access)
    .use(requestBodyLimit(input.config.requestBodyLimitBytes, rawBodyRoutes))
    // A handler only returns after its transaction committed; failures skip this hook.
    .onAfterHandle({ as: "global" }, ({ request, actor }) => {
      if (request.method !== "POST" && request.method !== "PATCH") return;
      const resource = changedResource(new URL(request.url).pathname);
      const businessId = actor?.activeBusinessId;
      if (!resource || !businessId) return;
      input.realtime.publish(businessId, {
        type: "business.changed",
        businessId,
        resource,
        at: new Date().toISOString(),
      });
    })
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
  const {
    businesses,
    cash,
    catalog,
    debtors,
    moneyTrend,
    movements,
    purchases,
    receivables,
    reports,
    sales,
  } = input.repositories;
  return app
    .use(businessRoutes({ access, businesses }))
    .use(salesRoutes({ access, sales }))
    .use(catalogRoutes({ access, catalog }))
    .use(cashRoutes({ access, cash }))
    .use(receivablesRoutes({ access, receivables }))
    .use(purchasesRoutes({ access, purchases }))
    .use(reportsRoutes({ access, reports }))
    .use(moneyTrendRoutes({ access, moneyTrend }))
    .use(movementsRoutes({ access, movements }))
    .use(debtorsRoutes({ access, debtors }))
    .use(assistantRoutes({ access, assistant: input.assistant }));
}
