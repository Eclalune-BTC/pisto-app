# API and Elysia

## Responsibility

`@pisto/api` is the HTTP composition root. It creates the Elysia application, registers cross-cutting
middleware, mounts Better Auth, validates public contracts, calls domain/repository functions, and
maps expected failures to stable error envelopes. Business logic belongs in its owning package.

The local listener defaults to `0.0.0.0:3001`. A container host can inject `PORT`
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
| `GET` (WebSocket) | `/v1/realtime` | Yes, member of the active business; allowed Origin | Change notices for the active business (`ready`, `business.changed`, `pong`); see [realtime](#realtime) |
| `GET` | `/v1/businesses` | Yes, fresh session | Explicit memberships and active business selector |
| `POST` | `/v1/businesses` | Yes, fresh session | Create or replay the one owner business and settings |
| `GET` | `/v1/sales` | `sales:read`, fresh session | List active-business sales by occurrence, newest first, with a status filter |
| `POST` | `/v1/sales` | `sales:create`, fresh session | Confirm or replay one total-only sale |
| `POST` | `/v1/sales/itemized` | `sales:create`, fresh session | Post or replay one itemized sale with stock, payment and credit |
| `GET` | `/v1/sales/form-options` | `sales:create`, fresh session | Active payment accounts without balances |
| `GET`, `POST` | `/v1/sales/review` | `sales:create`, fresh session | Read or prepare the current actor/business review without posting |
| `POST` | `/v1/sales/review/:reviewId/confirm` | `sales:create`, fresh session | Explicitly confirm the stored review and retain its result |
| `POST` | `/v1/sales/review/:reviewId/dismiss` | `sales:create`, fresh session | Dismiss or acknowledge the exact saved-sale ID |
| `GET` | `/v1/sales/:saleId` | `sales:read`, fresh session | Read a canonical active-business sale and its itemized details |
| `POST` | `/v1/sales/:saleId/void` | `sales:correct`, fresh session | Void or exactly replay one posted sale correction |
| `POST` | `/v1/sales/:saleId/replace` | `sales:correct`, fresh session | Atomically void and replace or exactly replay one sale |
| `GET` | `/v1/sales/summary/previous-month` | `sales:summary:read`, fresh session | Calculate the previous business-local calendar month |
| `GET` | `/v1/reports/operating` | `reports:read`, fresh session | Exact period flows and current positions in one repeatable-read transaction |
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
| `GET` | `/v1/assistant/status` | Yes, fresh session | Whether a model provider is composed (`enabled`, `transcription`) |
| `POST` | `/v1/assistant/interpretations` | `assistant:use`, fresh session; assistant budgets | Turn one sentence into a reviewable draft; nothing is saved |
| `POST` | `/v1/assistant/transcriptions` | `assistant:use`, fresh session, allowlisted Origin; assistant budgets | Transcribe a raw `audio/wav` body (own byte cap) to editable text |

The implementation and `@pisto/contracts` are definitive. Update this table and the
[Postman collection](postman/pisto.postman_collection.json) in the same change as a route addition
or removal. The collection calls every Pisto route and every Better Auth endpoint the app uses,
in order, against a fresh account, and asserts each response. See
[the README](../README.md#api-collection-postman-or-bruno) for how to run it.

All Better Auth organization routes are denied at the Elysia edge except
`POST /api/auth/organization/set-active`. Pisto owns business onboarding and does not expose raw
organization, invitation, member, role, or team mutations.

## Request pipeline

The implemented order is:

1. request ID generation or validation;
2. exact credentialed CORS and application-owned security headers;
3. header-only request policy: declared `Content-Length` above the limit, plus JSON media type and
   exact-Origin checks for unsafe `/v1` methods;
4. for business routes, one session read, actor resolution, write pause and PostgreSQL request budget;
5. bounded body buffering for methods other than GET, HEAD and OPTIONS;
6. raw Better Auth dispatch or route parsing; session-only routes resolve their session here;
7. identifier, JSON and shared Zod contract validation;
8. handler and repository authorization/domain call;
9. centralized error normalization and response security headers;
10. structured completion logging using route patterns, including routed OPTIONS preflights.

Elysia's `onRequest` is always global and is the only hook that runs before body parsing
([lifecycle](https://elysiajs.com/essential/life-cycle), checked against the installed 1.4.30
`compose`, 2026-10-04). Business authentication, budget charging and body bounding therefore stay
in global `onRequest` hooks, and steps 3 to 5 run in registration order so an anonymous,
foreign-origin or rate-limited command is rejected before its body is read.

Which `/v1` paths are business routes is not a hand-written list. `app.ts` mounts two session-policy
groups, `routes/v1.ts` (version marker and `/v1/me`) and `routes/billing.ts` (billing and the
RevenueCat webhook), and `sessionPolicyPaths()` exempts exactly their mounted paths. Every other
`/v1/*` path, including an unknown one, is authenticated and charged, so a route added outside those
groups cannot silently skip the policy. Session-policy routes must be static paths; a parameterized
one fails at startup because `onRequest` runs before routing. Session-policy groups use
`sessionContext()`, a scoped `derive` that requires a session before contract validation and
never charges the business budget. Elysia runs `parse` before `derive`, and `parse: "none"` also
skips body validation, so the billing checkout and portal routes keep the already-buffered body as
text in `parse` and decode it in a route `transform` after the session and billing-scope derives.
An anonymous caller with malformed JSON therefore receives 401, an out-of-scope member 403, and only
then does malformed JSON return 400 `BAD_REQUEST` and an invalid contract 400 `VALIDATION_ERROR`.

`request-policy.ts` owns the response headers and byte limit; these are not framework defaults.
Preflights bypass body and session gates. Better Auth and RevenueCat routes use `parse: "none"`:
the bounded request buffer preserves payload bytes without automatic JSON parsing, including
whitespace used by signature verifiers. This is bounded buffering, not unbuffered upload streaming.

Bun's `maxRequestBodySize` is left at its default. Bun enforces it for both declared and chunked
bodies (observed on Bun 1.3.14, 2026-10-04; recheck on Bun upgrades), but rejects with an empty `413` and `Connection: close` before the fetch handler runs, so a
limit equal to `API_REQUEST_BODY_LIMIT_BYTES` would drop the request ID, security headers and JSON
error envelope. The application limit is the enforced contract.

Elysia CORS must run before affected routes. When credentials are allowed, never use `*`; use the
exact configured origin and keep it synchronized with Better Auth `trustedOrigins`. In production,
configured CORS origins must use HTTPS and cannot use localhost, loopback, reserved TLDs, or the
example domains.

CORS controls response sharing, not whether a credentialed request executes. A browser `POST` with
a present `Origin` must match the configured client allowlist, and every `/v1` POST requires
the exact `application/json` media type before route parsing. Case and parameters such as
`; charset=utf-8` are accepted; lookalikes such as `application/jsonp` return 415. Native clients may
omit `Origin` but still send JSON. This follows [HTTP media types](https://www.rfc-editor.org/rfc/rfc9110.html#section-8.3.1),
reviewed 2026-10-03; recheck on request-policy changes.

## Response contract

Success responses use a top-level `data` object except for operational health probes and provider
webhook acknowledgements. Creation commands use `commandResponse()` to return Elysia's typed
`status()` result: 201 for a new resource and 200 for an exact replay, with the same `{ data }` envelope.
This HTTP policy does not select a repository or infer permissions. Errors use:

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
- The Elysia edge returns `404` for direct `/api/auth/checkout`, checkout subpaths, and
  `/api/auth/customer` paths. The authenticated `/v1` wrappers invoke the provider adapter
  internally only after catalog and active-scope checks. The signed `/api/auth/polar/webhooks`
  endpoint remains externally reachable.
- Checkout passes the authorized active organization as adapter input `reference_id`, which Polar
  stores in `metadata.referenceId`. The portal remains scoped to
  the purchasing Polar customer; organization membership does not grant access to another member's
  customer portal. The portal POST accepts the documented empty JSON object or an empty body.
- Billing routes check the session first, then the active-scope membership where they need it,
  then the request contract, then whether Polar is enabled.
- `/v1/billing/checkout` and `/v1/billing/portal` call Polar through `auth.handler`, not
  `auth.api.checkout`/`auth.api.portal`: the endpoints exist at runtime, but `Auth` erases plugin
  endpoint types and only the handler path runs Better Auth's origin check, rate limiter and the
  error-privacy plugin.
- Webhook handlers must receive the exact request body required by the provider verifier, verify
  before parsing/trusting, and deduplicate before applying state.
- `customerState` is an opaque provider payload using Polar API `2026-10` snake_case fields. User
  state is direct; organization state retains `{ result: { items, pagination } }` for the first page.
  Required result collections are validated. Internal entitlement records remain the authorization
  source; no application UI reads provider-owned state properties.

## Validation and errors

Routes declare `body` and `query` schemas through the Standard Schema `contract()` adapter. It keeps
the existing Zod messages, flattened details and HTTP 400 responses instead of exposing Elysia's
submitted-value diagnostics. `protectedRoutes()` supplies the request actor and the `record` macro.
List queries use `queryContract(schema, message)`, which requires a strict Zod object contract at
route declaration and passes every query parameter to it, so an unknown key such as a typo, a
tracking tag or a client-supplied tenant returns 400 `VALIDATION_ERROR` instead of being dropped.
`__proto__`, which Zod's strict check deliberately skips, is rejected explicitly. A repeated key
returns 400 `VALIDATION_ERROR` rather than choosing the first or last occurrence, because a proxy
and this API could otherwise act on different values. Values remain scalar strings.
The `record` macro rejects malformed identifiers as 404 before parsing a command body (in `parse`)
and on GET/HEAD (in `transform`, because Elysia does not run parse hooks for those methods). A
`record` field that is not a route parameter is a programming error: `transform` throws and the
request fails as 500 instead of looking like a missing record.
Commands without record parameters explicitly select JSON parsing so absent bodies still produce
BAD_REQUEST.

The pinned baseline is Elysia 1.4.30 with `@elysiajs/cors@1.4.2`; current upstream pages can show
Elysia 2 beta APIs such as `@elysia/cors`. Use [ADR 0019](adrs/0019-elysia-http-composition.md),
the exact installed source and the API regression tests when applying version-sensitive examples.

- Validate params, query, headers, and body at the route boundary.
- Reject unknown fields on mutation contracts where ambiguity is unsafe.
- Use `400` for malformed input, `401` for no valid session, `403` for a known identity without
  permission, `404` for absent/undisclosed resources, `409` for domain conflicts, and `503` for a
  required dependency that is temporarily unavailable.
- Treat client cancellation and provider failure as expected outcomes, not internal exceptions.
- Add a request ID to logs and responses; do not use provider event IDs as general request IDs.

## Realtime

`apps/api/src/realtime.ts` owns the WebSocket channel. The handshake happens outside Elysia (Bun's
`server.upgrade` locally, a `WebSocketPair` in the Durable Object) after `authorizeRealtime` checks
the Origin against `CORS_ORIGINS`, a fresh session, an active business and a membership row. After
any successful `POST`/`PATCH` to a business area, an `onAfterHandle` hook publishes
`{ type: "business.changed", businessId, resource, at }` to that business's sockets; a failed
command publishes nothing. Clients send `{ type: "ping" }` and receive `{ type: "pong" }`. Notices
never contain record data, so a client always refetches through the authorized REST endpoints.
Message schemas live in `packages/contracts/src/realtime.ts`.

## Health and shutdown

`/health` should stay cheap and return if the event loop can serve traffic. `/ready` may perform a
bounded database probe, but must not create connections without a timeout or call every external
provider. Billing readiness reports configured/disabled, not whether Polar is globally reachable.

The Bun listener handles `SIGTERM` and `SIGINT` with one bounded nine-second shutdown: it stops
accepting requests, waits for in-flight work within the deadline, forces HTTP stop if needed, and
closes the PostgreSQL pool. The server can handle concurrent requests, so mutable module globals must
not hold request/user state.

## Official sources

- [Elysia getting started](https://elysiajs.com/quick-start)
- [Elysia 1.4.30 release](https://github.com/elysiajs/elysia/releases/tag/1.4.30)
- [Elysia CORS middleware](https://elysiajs.com/plugins/cors)
- [OWASP security headers](https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html)
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [RFC 9111 `no-store`](https://www.rfc-editor.org/rfc/rfc9111.html#name-no-store)
- [Elysia validation](https://elysiajs.com/essential/validation)
- [Better Auth Elysia integration](https://elysiajs.com/integrations/better-auth)
- [Elysia lifecycle](https://elysiajs.com/essential/life-cycle)
