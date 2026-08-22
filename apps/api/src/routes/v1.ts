import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import { RevenueCatWebhookError } from "@pisto/billing";
import { billingCheckoutRequestSchema, billingPortalRequestSchema } from "@pisto/contracts";
import type { Database, ProductRepository } from "@pisto/db";
import { Hono } from "hono";
import { z } from "zod";

import { ApiError } from "../errors.ts";
import { callAuthEndpoint, parseJsonBody, parseOptionalJsonBody } from "../http.ts";
import { requireSession, resolveBillingScope } from "../session.ts";
import type { AppEnv } from "../types.ts";
import { productRoutes } from "./product.ts";

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
  billing: BillingRuntime;
  db: Database;
  product: ProductRepository;
}) {
  const routes = new Hono<AppEnv>();

  routes.get("/", (context) =>
    context.json({ data: { version: "v1" as const, service: "pisto-api" as const } }),
  );

  routes.route("/", productRoutes({ auth: input.auth, product: input.product }));

  routes.get("/me", async (context) => {
    const authSession = await requireSession(input.auth, context.req.raw.headers);
    const session = authSession.session as typeof authSession.session & {
      activeOrganizationId?: string | null;
    };
    return context.json({
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
    });
  });

  routes.get("/billing/catalog", (context) =>
    context.json({
      data: {
        status: input.billing.config.polar.enabled ? ("enabled" as const) : ("disabled" as const),
        provider: input.billing.config.polar.enabled ? ("polar" as const) : null,
        products: input.billing.catalog,
      },
    }),
  );

  routes.get("/billing/entitlements", async (context) => {
    const session = await requireSession(input.auth, context.req.raw.headers);
    const scope = await resolveBillingScope({ db: input.db, session });
    return context.json({
      data: {
        scope,
        items: await input.billing.listEntitlements(scope),
      },
    });
  });

  routes.get("/billing/state", async (context) => {
    const session = await requireSession(input.auth, context.req.raw.headers);
    const scope = await resolveBillingScope({ db: input.db, session });
    const entitlements = await input.billing.listEntitlements(scope);
    if (!input.billing.config.polar.enabled) {
      return context.json({
        data: {
          status: "disabled" as const,
          provider: null,
          scope,
          customerState: null,
          entitlements,
        },
      });
    }

    const path =
      scope.type === "organization"
        ? `/api/auth/customer/subscriptions/list?referenceId=${encodeURIComponent(scope.id)}&active=true`
        : "/api/auth/customer/state";
    const customerState = await callAuthEndpoint({
      auth: input.auth,
      baseUrl: input.authBaseUrl,
      path,
      method: "GET",
      headers: context.req.raw.headers,
    });
    return context.json({
      data: {
        status: "enabled" as const,
        provider: "polar" as const,
        scope,
        customerState,
        entitlements,
      },
    });
  });

  routes.post("/billing/checkout", async (context) => {
    if (!input.billing.config.polar.enabled) {
      throw new ApiError(503, "BILLING_DISABLED", "Polar checkout is disabled");
    }
    const session = await requireSession(input.auth, context.req.raw.headers);
    const scope = await resolveBillingScope({ db: input.db, session });
    const body = billingCheckoutRequestSchema.safeParse(await parseJsonBody(context));
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Checkout request is invalid",
        body.error.flatten(),
      );
    }
    if (!input.billing.config.polar.products.some(({ slug }) => slug === body.data.slug)) {
      throw new ApiError(404, "NOT_FOUND", "Billing product was not found");
    }
    const payload = await callAuthEndpoint({
      auth: input.auth,
      baseUrl: input.authBaseUrl,
      path: "/api/auth/checkout",
      method: "POST",
      headers: context.req.raw.headers,
      body: {
        slug: body.data.slug,
        ...(scope.type === "organization" ? { referenceId: scope.id } : {}),
        redirect: false,
      },
    });
    return context.json(parseProviderRedirect(payload));
  });

  routes.post("/billing/portal", async (context) => {
    if (!input.billing.config.polar.enabled) {
      throw new ApiError(503, "BILLING_DISABLED", "Polar customer portal is disabled");
    }
    await requireSession(input.auth, context.req.raw.headers);
    const rawBody = await parseOptionalJsonBody(context);
    const body = billingPortalRequestSchema.safeParse(rawBody);
    if (!body.success) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "Portal request is invalid",
        body.error.flatten(),
      );
    }
    const payload = await callAuthEndpoint({
      auth: input.auth,
      baseUrl: input.authBaseUrl,
      // Polar's Better Auth portal is customer-scoped, including after an
      // organization referenceId checkout. It must not be treated as an
      // organization-wide billing administrator portal.
      path: "/api/auth/customer/portal",
      method: "POST",
      headers: context.req.raw.headers,
      body: { redirect: false },
    });
    return context.json(parseProviderRedirect(payload));
  });

  routes.post("/webhooks/revenuecat", async (context) => {
    const rawBody = await context.req.text();
    try {
      const result = await input.billing.processRevenueCatWebhook({
        authorization: context.req.header("authorization") ?? null,
        signature: context.req.header("x-revenuecat-webhook-signature") ?? null,
        rawBody,
      });
      return context.json({ received: true as const, ...result });
    } catch (error) {
      if (error instanceof RevenueCatWebhookError) {
        throw new ApiError(
          error.status,
          error.status === 401
            ? "UNAUTHORIZED"
            : error.status === 409
              ? "CONFLICT"
              : error.status === 503
                ? "BILLING_DISABLED"
                : "BAD_REQUEST",
          error.message,
        );
      }
      throw error;
    }
  });

  return routes;
}
