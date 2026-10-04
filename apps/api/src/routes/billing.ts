import type { Auth } from "@pisto/auth";
import type { BillingRuntime } from "@pisto/billing";
import { billingCheckoutRequestSchema, billingPortalRequestSchema } from "@pisto/contracts";
import type { Database } from "@pisto/db";
import { Elysia } from "elysia";
import { z } from "zod";
import { ApiError } from "../errors.ts";
import { contract } from "../http.ts";
import { resolveBillingScope, sessionContext } from "../session.ts";

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

function statusForAuthResponse(status: number): 400 | 401 | 403 | 500 | 503 {
  if (status === 400) return 400;
  if (status === 401) return 401;
  if (status === 403) return 403;
  if (status >= 500) return 503;
  return 500;
}

/**
 * Calls a Polar endpoint through Better Auth's request handler. `auth.api.checkout` exists at
 * runtime, but `Auth` erases plugin endpoint types and the handler path also keeps Better Auth's
 * own origin check and rate limits for these provider calls.
 */
export async function callAuthEndpoint(input: {
  auth: Auth;
  baseUrl: string;
  path: string;
  method: "GET" | "POST";
  headers: Headers;
  body?: unknown;
}): Promise<unknown> {
  const headers = new Headers(input.headers);
  headers.delete("content-length");
  headers.set("accept", "application/json");
  if (input.body !== undefined) headers.set("content-type", "application/json");
  const response = await input.auth.handler(
    new Request(new URL(input.path, input.baseUrl), {
      method: input.method,
      headers,
      ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
    }),
  );
  if (!response.ok) {
    const status = statusForAuthResponse(response.status);
    throw new ApiError(
      status,
      status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "BILLING_UNAVAILABLE",
      status === 401 || status === 403
        ? "Authentication is required for this billing operation"
        : "The billing provider request failed",
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ApiError(503, "BILLING_UNAVAILABLE", "The billing provider returned invalid JSON");
  }
}

/** The portal accepts the documented empty JSON object and also an empty body. */
async function parseOptionalJsonBody({ request }: { request: Request }): Promise<unknown> {
  const rawBody = await request.text();
  if (!rawBody.trim()) return {};
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw new ApiError(400, "BAD_REQUEST", "Request body must be valid JSON");
  }
}

/** Billing and store webhooks own their session policy and bypass the business request budget. */
export function billingRoutes(input: {
  auth: Auth;
  authBaseUrl: string;
  billing: BillingRuntime;
  db: Database;
}) {
  const requireCheckoutEnabled = (feature: string) => {
    if (!input.billing.checkoutEnabled) {
      throw new ApiError(503, "BILLING_DISABLED", `Polar ${feature} is disabled`);
    }
  };

  return new Elysia({ strictPath: true })
    .get("/v1/billing/catalog", () => ({
      data: {
        status: input.billing.checkoutEnabled ? ("enabled" as const) : ("disabled" as const),
        provider: input.billing.checkoutEnabled ? ("polar" as const) : null,
        products: input.billing.catalog,
      },
    }))
    .post(
      "/v1/webhooks/revenuecat",
      async ({ request }) => {
        const result = await input.billing.processRevenueCatWebhook({
          authorization: request.headers.get("authorization"),
          signature: request.headers.get("x-revenuecat-webhook-signature"),
          rawBody: await request.text(),
        });
        return { received: true as const, ...result };
      },
      { parse: "none" },
    )
    .use(sessionContext(input.auth))
    .post(
      "/v1/billing/portal",
      async ({ request }) => {
        requireCheckoutEnabled("customer portal");
        const payload = await callAuthEndpoint({
          auth: input.auth,
          baseUrl: input.authBaseUrl,
          // Polar's Better Auth portal is customer-scoped, including after an
          // organization referenceId checkout. It must not be treated as an
          // organization-wide billing administrator portal.
          path: "/api/auth/customer/portal",
          method: "POST",
          headers: request.headers,
          body: { redirect: false },
        });
        return parseProviderRedirect(payload);
      },
      {
        parse: parseOptionalJsonBody,
        body: contract(billingPortalRequestSchema, "Portal request is invalid"),
      },
    )
    .derive(async ({ session }) => ({
      scope: await resolveBillingScope({ db: input.db, session }),
    }))
    .get("/v1/billing/entitlements", async ({ scope }) => ({
      data: { scope, items: await input.billing.listEntitlements(scope) },
    }))
    .get("/v1/billing/state", async ({ scope }) => {
      const entitlements = await input.billing.listEntitlements(scope);
      if (!input.billing.checkoutEnabled) {
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
      return {
        data: {
          status: "enabled" as const,
          provider: "polar" as const,
          scope,
          customerState: await input.billing.readCustomerState(scope),
          entitlements,
        },
      };
    })
    .post(
      "/v1/billing/checkout",
      async ({ body, request, scope }) => {
        requireCheckoutEnabled("checkout");
        if (!input.billing.hasProduct(body.slug)) {
          throw new ApiError(404, "NOT_FOUND", "Billing product was not found");
        }
        const payload = await callAuthEndpoint({
          auth: input.auth,
          baseUrl: input.authBaseUrl,
          path: "/api/auth/checkout",
          method: "POST",
          headers: request.headers,
          body: {
            slug: body.slug,
            ...(scope.type === "organization" ? { reference_id: scope.id } : {}),
            redirect: false,
          },
        });
        return parseProviderRedirect(payload);
      },
      {
        parse: "json",
        body: contract(billingCheckoutRequestSchema, "Checkout request is invalid"),
      },
    );
}
