import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import { billingCheckoutRequestSchema, billingPortalRequestSchema } from "@pisto/contracts";
import type {
  CashRepository,
  CatalogRepository,
  Database,
  ProductRepository,
  ReceivablesRepository,
  ReportsRepository,
} from "@pisto/db";
import { Elysia } from "elysia";
import { z } from "zod";
import { ApiError } from "../errors.ts";
import { callAuthEndpoint, parseJsonBody, parseOptionalJsonBody, parseRequest } from "../http.ts";
import type { ProductAccess } from "../middleware/product-access.ts";
import { requireSession, resolveBillingScope } from "../session.ts";
import { cashRoutes } from "./cash.ts";
import { catalogRoutes } from "./catalog.ts";
import { productRoutes } from "./product.ts";
import { receivablesRoutes } from "./receivables.ts";
import { reportsRoutes } from "./reports.ts";

const providerRedirectSchema = z.object({
  url: z.string().url(),
  redirect: z.boolean(),
});

function parseProviderRedirect(payload: unknown) {
  const parsed = providerRedirectSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(
      503,
      "BILLING_UNAVAILABLE",
      "The billing provider returned an invalid redirect response",
    );
  }
  return { data: { url: parsed.data.url, redirect: false as const } };
}

export function v1Routes(input: {
  auth: Auth;
  authBaseUrl: string;
  access: ProductAccess;
  billing: BillingRuntime;
  cash: CashRepository;
  catalog: CatalogRepository;
  db: Database;
  product: ProductRepository;
  receivables: ReceivablesRepository;
  reports: ReportsRepository;
}) {
  const routes = new Elysia({ strictPath: true });

  routes.get("/v1/", () => ({
    data: { version: "v1" as const, service: "pisto-api" as const },
  }));

  routes.get("/v1/me", async (context) => {
    const authSession = await requireSession(input.auth, context.request.headers);
    const session = authSession.session as typeof authSession.session & {
      activeOrganizationId?: string | null;
    };
    return {
      data: {
        user: {
          id: authSession.user.id,
          name: authSession.user.name,
          email: authSession.user.email,
          emailVerified: authSession.user.emailVerified,
          image: authSession.user.image ?? null,
        },
        session: {
          id: session.id,
          expiresAt: new Date(session.expiresAt).toISOString(),
          activeOrganizationId: session.activeOrganizationId ?? null,
        },
      },
    };
  });

  routes.get("/v1/billing/catalog", () => ({
    data: {
      status: input.billing.config.polar.enabled ? ("enabled" as const) : ("disabled" as const),
      provider: input.billing.config.polar.enabled ? ("polar" as const) : null,
      products: input.billing.catalog,
    },
  }));

  routes.get("/v1/billing/entitlements", async (context) => {
    const session = await requireSession(input.auth, context.request.headers);
    const scope = await resolveBillingScope({ db: input.db, session });
    return {
      data: {
        scope,
        items: await input.billing.listEntitlements(scope),
      },
    };
  });

  routes.get("/v1/billing/state", async (context) => {
    const session = await requireSession(input.auth, context.request.headers);
    const scope = await resolveBillingScope({ db: input.db, session });
    const entitlements = await input.billing.listEntitlements(scope);
    if (!input.billing.config.polar.enabled) {
      return {
        data: {
          status: "disabled" as const,
          provider: null,
          scope,
          customerState: null,
          entitlements,
        },
      };
    }

    const customerState = await input.billing.readCustomerState(scope);
    return {
      data: {
        status: "enabled" as const,
        provider: "polar" as const,
        scope,
        customerState,
        entitlements,
      },
    };
  });

  routes.post(
    "/v1/billing/checkout",
    async (context) => {
      if (!input.billing.config.polar.enabled) {
        throw new ApiError(503, "BILLING_DISABLED", "Polar checkout is disabled");
      }
      const session = await requireSession(input.auth, context.request.headers);
      const scope = await resolveBillingScope({ db: input.db, session });
      const command = parseRequest(
        billingCheckoutRequestSchema,
        await parseJsonBody(context.request),
        "Checkout request is invalid",
      );
      if (!input.billing.config.polar.products.some(({ slug }) => slug === command.slug)) {
        throw new ApiError(404, "NOT_FOUND", "Billing product was not found");
      }
      const payload = await callAuthEndpoint({
        auth: input.auth,
        baseUrl: input.authBaseUrl,
        path: "/api/auth/checkout",
        method: "POST",
        headers: context.request.headers,
        body: {
          slug: command.slug,
          ...(scope.type === "organization" ? { referenceId: scope.id } : {}),
          redirect: false,
        },
      });
      return parseProviderRedirect(payload);
    },
    { parse: "none" },
  );

  routes.post(
    "/v1/billing/portal",
    async (context) => {
      if (!input.billing.config.polar.enabled) {
        throw new ApiError(503, "BILLING_DISABLED", "Polar customer portal is disabled");
      }
      await requireSession(input.auth, context.request.headers);
      parseRequest(
        billingPortalRequestSchema,
        await parseOptionalJsonBody(context.request),
        "Portal request is invalid",
      );
      const payload = await callAuthEndpoint({
        auth: input.auth,
        baseUrl: input.authBaseUrl,
        // Polar's Better Auth portal is customer-scoped, including after an
        // organization referenceId checkout. It must not be treated as an
        // organization-wide billing administrator portal.
        path: "/api/auth/customer/portal",
        method: "POST",
        headers: context.request.headers,
        body: { redirect: false },
      });
      return parseProviderRedirect(payload);
    },
    { parse: "none" },
  );

  routes.post(
    "/v1/webhooks/revenuecat",
    async (context) => {
      const rawBody = await context.request.text();
      const result = await input.billing.processRevenueCatWebhook({
        authorization: context.request.headers.get("authorization") ?? null,
        signature: context.request.headers.get("x-revenuecat-webhook-signature") ?? null,
        rawBody,
      });
      return { received: true as const, ...result };
    },
    { parse: "none" },
  );

  routes.get("/v1", () => ({ data: { version: "v1" as const, service: "pisto-api" as const } }));
  routes.use(productRoutes({ access: input.access, product: input.product }));
  routes.use(catalogRoutes({ access: input.access, catalog: input.catalog }));
  routes.use(cashRoutes({ access: input.access, cash: input.cash }));
  routes.use(receivablesRoutes({ access: input.access, receivables: input.receivables }));
  routes.use(reportsRoutes({ access: input.access, reports: input.reports }));
  return routes;
}
