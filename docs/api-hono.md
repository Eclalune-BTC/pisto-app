# API and Hono

## Responsibility

`@pisto/api` is the HTTP composition root. It creates the Hono application, registers cross-cutting
middleware, mounts Better Auth, validates public contracts, calls domain/repository functions, and
maps expected failures to stable error envelopes. Business logic belongs in its owning package.

The local listener defaults to `0.0.0.0:3001`. Production must prefer Cloud Run's injected `PORT`
while continuing to bind `0.0.0.0`.

## Public surface

The baseline surface is:

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Process liveness; no dependency mutation |
| `GET` | `/ready` | No | Database readiness and billing configuration state |
| `GET`, `POST` | `/api/auth`, `/api/auth/*` | Route-specific | Better Auth identity/session handler; provider billing guards run first |
| `GET` | `/v1` | No | API version marker |
| `GET` | `/v1/me` | Yes | Normalized user and session summary |
| `GET` | `/v1/businesses` | Yes, fresh session | Explicit memberships and active business selector |
| `POST` | `/v1/businesses` | Yes, fresh session | Create or replay the one owner business and settings |
| `GET` | `/v1/sales` | `sales:read`, fresh session | List active-business sales newest first with a status filter |
| `POST` | `/v1/sales` | `sales:create`, fresh session | Confirm or replay one total-only sale |
| `GET` | `/v1/sales/:saleId` | `sales:read`, fresh session | Read a canonical active-business sale |
| `POST` | `/v1/sales/:saleId/void` | `sales:correct`, fresh session | Void or exactly replay one posted sale correction |
| `POST` | `/v1/sales/:saleId/replace` | `sales:correct`, fresh session | Atomically void and replace or exactly replay one sale |
| `GET` | `/v1/sales/summary/previous-month` | `sales:summary:read`, fresh session | Calculate the previous business-local calendar month |
| `GET` | `/v1/billing/catalog` | No | Allowlisted public web product catalog |
| `GET` | `/v1/billing/state` | Yes | Current provider and normalized entitlement state |
| `GET` | `/v1/billing/entitlements` | Yes | Internal entitlement projection |
| `POST` | `/v1/billing/checkout` | Yes, web only | Create a Polar checkout for an allowlisted slug |
| `POST` | `/v1/billing/portal` | Yes, web only | Create/open Polar customer portal flow |
| `POST` | `/api/auth/polar/webhooks` | Signed provider request | Polar webhook handler when billing is enabled |
| `POST` | `/v1/webhooks/revenuecat` | RevenueCat Authorization and optional HMAC | Project native-store events when RevenueCat is enabled |
| `GET` | `/v1/catalog/categories` | `catalog:read`, fresh session | List active-business product categories |
| `POST` | `/v1/catalog/categories` | `catalog:manage`, fresh session | Create or replay one category |
| `PATCH` | `/v1/catalog/categories/:categoryId` | `catalog:manage`, fresh session | Update one category |
| `POST` | `/v1/catalog/categories/:categoryId/archive` | `catalog:manage`, fresh session | Archive one category |
| `GET` | `/v1/catalog/products` | `catalog:read`, fresh session | List products with search and status filters |
| `POST` | `/v1/catalog/products` | `catalog:manage`, fresh session | Create or replay one product |
| `GET` | `/v1/catalog/products/:productId` | `catalog:read`, fresh session | Read one product |
| `PATCH` | `/v1/catalog/products/:productId` | `catalog:manage`, fresh session | Update one product |
| `POST` | `/v1/catalog/products/:productId/archive` | `catalog:manage`, fresh session | Archive one product |
| `GET` | `/v1/inventory/stock` | `inventory:read`, fresh session | List tracked stock with a low-stock filter |
| `GET` | `/v1/inventory/products/:productId/movements` | `inventory:read`, fresh session | List one product's movement history |
| `POST` | `/v1/inventory/products/:productId/movements` | `inventory:manage`, fresh session | Record or replay one stock movement |
| `POST` | `/v1/inventory/movements/:movementId/reverse` | `inventory:manage`, fresh session | Reverse one movement exactly once |
| `GET` | `/v1/cash/accounts` | `cash:read`, fresh session | List cash accounts and derived balances |
| `POST` | `/v1/cash/accounts` | `cash:manage`, fresh session | Create or replay one cash account |
| `GET` | `/v1/cash/accounts/:accountId` | `cash:read`, fresh session | Read one account with its balance |
| `POST` | `/v1/cash/accounts/:accountId/update` | `cash:manage`, fresh session | Update one account reference, never its balance |
| `POST` | `/v1/cash/accounts/:accountId/archive` | `cash:manage`, fresh session | Archive one cash account |
| `GET` | `/v1/cash/movements` | `cash:read`, fresh session | List ledger movements |
| `POST` | `/v1/cash/adjustments` | `cash:manage`, fresh session | Record or replay one balance adjustment |
| `POST` | `/v1/cash/movements/:movementId/reverse` | `cash:manage`, fresh session | Reverse one movement exactly once |
| `POST` | `/v1/cash/transfers` | `cash:manage`, fresh session | Record one linked outgoing/incoming pair |
| `GET` | `/v1/expenses` | `expenses:read`, fresh session | List paid expenses with filters |
| `GET` | `/v1/expenses/summary` | `expenses:read`, fresh session | Aggregate one business-local period |
| `POST` | `/v1/expenses` | `expenses:manage`, fresh session | Post or replay one paid expense and its cash movement |
| `GET` | `/v1/expenses/:expenseId` | `expenses:read`, fresh session | Read one expense |
| `POST` | `/v1/expenses/:expenseId/void` | `expenses:manage`, fresh session | Void one posted expense |
| `GET` | `/v1/customers` | `customers:read`, fresh session | List customers with search |
| `POST` | `/v1/customers` | `customers:manage`, fresh session | Create or replay one customer |
| `GET` | `/v1/customers/:customerId` | `customers:read`, fresh session | Read one customer |
| `POST` | `/v1/customers/:customerId/update` | `customers:manage`, fresh session | Update one customer |
| `POST` | `/v1/customers/:customerId/archive` | `customers:manage`, fresh session | Archive one customer |
| `GET` | `/v1/receivables` | `receivables:read`, fresh session | List receivables with derived balances |
| `GET` | `/v1/receivables/summary` | `receivables:read`, fresh session | Aggregate outstanding and overdue balances |
| `POST` | `/v1/receivables` | `receivables:manage`, fresh session | Create or replay one charge |
| `GET` | `/v1/receivables/:receivableId` | `receivables:read`, fresh session | Read one receivable and its payments |
| `POST` | `/v1/receivables/:receivableId/payments` | `receivables:manage` and `cash:manage`, fresh session | Record one payment and its linked cash movement |
| `POST` | `/v1/receivables/:receivableId/void` | `receivables:manage`, fresh session | Void one receivable after its payments are reversed |
| `POST` | `/v1/receivable-payments/:paymentId/reverse` | `receivables:manage` and `cash:manage`, fresh session | Reverse one payment exactly once |

The implementation and `@pisto/contracts` are definitive. Update this table in the same change as a
route addition or removal.

All Better Auth organization routes are denied at the Hono edge except
`POST /api/auth/organization/set-active`. Pisto owns business onboarding and does not expose raw
organization, invitation, member, role, or team mutations.

## Request pipeline

Recommended order:

1. request ID generation or validation;
2. structured request logging with redaction;
3. secure response headers;
4. exact CORS policy, including credentials only for approved origins;
5. request/body limits plus JSON and exact-Origin checks for unsafe `/v1` methods;
6. Better Auth raw request handler for `/api/auth/*`;
7. session guard for protected `/v1/*` routes;
8. Zod contract validation;
9. handler and domain call;
10. centralized error normalization.

Hono CORS must run before affected routes. When credentials are allowed, never use `*`; use the
exact configured origin and keep it synchronized with Better Auth `trustedOrigins`. In production,
configured CORS origins must use HTTPS and cannot use localhost, loopback, reserved TLDs, or the
example domains.

CORS controls response sharing, not whether a credentialed request executes. A browser `POST` with
a present `Origin` must match the configured client allowlist, and every `/v1` POST requires
`application/json` before route parsing. Native clients may omit `Origin` but still send JSON.

## Response contract

Success responses use a top-level `data` object except for operational health probes and provider
webhook acknowledgements. Errors use:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "requestId": "request-correlation-id"
  }
}
```

`details` is optional and must not contain stack traces, SQL, tokens, cookies, raw provider payloads,
or sensitive personal data. Public error codes live in `@pisto/contracts`.

Every `/v1` response sets `Cache-Control: no-store`, including account, business, financial, and
billing data. Unexpected exceptions are logged only by stable type plus request ID; arbitrary driver
messages are not copied into logs or responses.

## Billing behavior

- When `BILLING_ENABLED=false`, catalog/state remain explicit and checkout/portal return the stable
  `BILLING_DISABLED` contract rather than placeholder URLs.
- The server accepts an internal product slug, maps it through its configured allowlist, and rejects
  arbitrary provider IDs.
- Checkout and portal endpoints return a URL to the client; the server does not perform an implicit
  redirect. This keeps redirect handling explicit across web and native clients.
- The Hono edge returns `404` for direct `/api/auth/checkout`, checkout subpaths, and
  `/api/auth/customer` paths. The authenticated `/v1` wrappers invoke the provider adapter
  internally only after catalog and active-scope checks. The signed `/api/auth/polar/webhooks`
  endpoint remains externally reachable.
- Checkout can attach the active organization as Polar's `referenceId`. The portal remains scoped to
  the purchasing Polar customer; organization membership does not grant access to another member's
  customer portal. The portal POST accepts the documented empty JSON object.
- Webhook handlers must receive the exact request body required by the provider verifier, verify
  before parsing/trusting, and deduplicate before applying state.

## Validation and errors

- Validate params, query, headers, and body at the route boundary.
- Reject unknown fields on mutation contracts where ambiguity is unsafe.
- Use `400` for malformed input, `401` for no valid session, `403` for a known identity without
  permission, `404` for absent/undisclosed resources, `409` for domain conflicts, and `503` for a
  required dependency that is temporarily unavailable.
- Treat client cancellation and provider failure as expected outcomes, not internal exceptions.
- Add a request ID to logs and responses; do not use provider event IDs as general request IDs.

## Health and shutdown

`/health` should stay cheap and return if the event loop can serve traffic. `/ready` may perform a
bounded database probe, but must not create connections without a timeout or call every external
provider. Billing readiness reports configured/disabled, not whether Polar is globally reachable.

The Bun listener handles `SIGTERM` and `SIGINT` with one bounded nine-second shutdown: it stops
accepting requests, waits for in-flight work within the deadline, forces HTTP stop if needed, and
closes the PostgreSQL pool. Cloud Run can send concurrent requests, so mutable module globals must
not hold request/user state.

## Official sources

- [Hono getting started](https://hono.dev/docs/getting-started/basic)
- [Hono Bun adapter](https://hono.dev/docs/getting-started/bun)
- [Hono CORS middleware](https://hono.dev/docs/middleware/builtin/cors)
- [Hono secure headers](https://hono.dev/docs/middleware/builtin/secure-headers)
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [RFC 9111 `no-store`](https://www.rfc-editor.org/rfc/rfc9111.html#name-no-store)
- [Hono validation](https://hono.dev/docs/guides/validation)
- [Better Auth Hono integration](https://better-auth.com/docs/integrations/hono)
- [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract)
