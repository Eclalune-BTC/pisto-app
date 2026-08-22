# Better Auth

## Decision

`@pisto/auth` centralizes authentication with Better Auth 1.7.1, its Drizzle adapter, and the Expo
integration. `@pisto/api` mounts the raw handler at `/api/auth` and `/api/auth/*`; other protected
routes resolve a session through the auth package rather than parsing cookies themselves.

Polar billing integration is not Polar social sign-in. The `@polar-sh/better-auth` billing plugin may
add checkout, portal, and webhook endpoints under the auth base path, but identity and paid access
remain separate concerns.

## Required server configuration

| Variable | Requirement |
| --- | --- |
| `BETTER_AUTH_SECRET` | At least 32 high-entropy characters; generated locally by `bun run setup` |
| `BETTER_AUTH_URL` | Exact public API/auth origin; production requires HTTPS and rejects reserved/example hosts |
| `TRUSTED_ORIGINS` | Explicit browser origins and approved exact app-scheme origins; wildcard entries and production placeholder hosts fail validation |
| `EXPO_SCHEME` | Stable private deep-link scheme, expected to be `pisto`; the auth package adds its scheme variants |
| `AUTH_EMAIL_PASSWORD_ENABLED` | Explicit feature switch; do not infer from missing variables |

The production secret comes from Secret Manager, not a committed file or Docker build argument.
Use Better Auth's documented multi-secret rotation mechanism when rotating; retain prior decryption
keys for the supported transition instead of invalidating sessions without a plan.

## Hono mounting

Mount the exact base and wildcard paths before a broad API catch-all. The composition root registers
the checkout/customer provider guards before these handlers:

```ts
const authHandler = (context: Context) => auth.handler(context.req.raw);

app.on(["GET", "POST"], "/api/auth", authHandler);
app.on(["GET", "POST"], "/api/auth/*", authHandler);
```

The mounted path and Better Auth `basePath` must agree. Apply credentialed CORS before this route and
use an exact origin, never `*`. Keep the same origins in Better Auth `trustedOrigins`.

## Expo session handling

- Use `@better-auth/expo` and `expo-secure-store` for native cookie/session persistence.
- Keep the client Expo plugin and server `advanced.cookiePrefix` aligned at `pisto`; changing one
  without the other breaks native cookie discovery.
- Configure the client with the complete API URL and auth base path.
- Configure `EXPO_SCHEME=pisto`; the auth package adds `pisto://` and its supported deep-link
  variant. Do not put wildcard entries directly in `TRUSTED_ORIGINS`.
- For authenticated API fetches on native, obtain the cookie through the Better Auth client and add
  it to the server request as documented by the Expo integration.
- Clear user-scoped query and billing caches on sign-out or identity switch.
- Do not copy the server secret, session database token, or OAuth client secret into Expo config.

SecureStore reduces casual disclosure on device; it does not make a compromised device trusted.
Server authorization and session expiry still apply.

## Password and session baseline

- Better Auth uses memory-hard `scrypt` password hashing by default; changing it requires an ADR and
  migration/rehash plan.
- Keep secure, HTTP-only, SameSite cookies in production and HTTPS end to end.
- Do not disable CSRF or origin validation to work around a local CORS problem.
- Keep session lifetime and renewal explicit; revoke server sessions on security-sensitive account
  changes.
- Better Auth rate-limit counters use the PostgreSQL-backed `rateLimit` model so protection is shared
  across Cloud Run instances. The implemented defaults are 100 requests per 60 seconds globally,
  3 per 10 seconds for email sign-in and sign-up, and 3 per 60 seconds for password-reset requests.
  Keep the limiter enabled and test sign-in, sign-up, reset, verification, and other abuse-prone
  routes.
- Avoid account enumeration: public messages should not reveal whether an email exists.

## Organization-backed business boundary

The server and Expo organization plugins plus organization/member/invitation schema are included.
Business onboarding creates one server-owned organization and exact `owner` membership. Hono blocks
raw organization creation, deletion, invitations, member/role/team mutations, and reads; only the
active-organization selector is exposed. Invitations and role administration are not implemented.

[ADR 0010](adrs/0010-organization-backed-business-tenancy.md) uses one organization identifier as
Pisto's `businessId` to avoid a second membership system. Apply these rules before product records:

- restrict organization creation to the approved owner onboarding path and configured limits;
- add the exact organization client plugin only with the truthful create/select UX;
- treat session `activeOrganizationId` as a selector and reload membership/action authorization on
  every protected request;
- store currency, time zone, and financial state in typed Pisto domain tables, never auth metadata;
- disable/intercept direct organization deletion before canonical business data exists; and
- deny invitation/member flows until verified email delivery, acceptance, role permissions, rate
  limits, denial tests, and audit are approved and implemented.

ADR 0014 recognizes exact `owner`, `admin`, and `member` membership values through one Pisto policy.
All three can complete the current daily sales flow; only `owner` can configure the business.
Unknown/composite roles fail closed. Better Auth role recognition does not itself authorize product
data, and raw role strings must not be checked ad hoc across routes, tools, or UI.

## Database ownership

Better Auth schema, including the database-backed `rateLimit` table, is represented in `@pisto/db`
so one migration system owns all PostgreSQL changes. Generate and review a migration after
plugin/schema changes. Auth identifiers are internal opaque identifiers and must not be email
addresses in provider integrations.

The schema workflow uses the installed `auth@1.7.1` CLI, aligned with `better-auth@1.7.1` and
`@better-auth/expo@1.7.1`:

```sh
bun run auth:schema:generate
bun run auth:schema:check
bun run db:generate
```

The first command writes reviewable generated output; the second compares that output with the
repository schema. Run `db:generate` only for an intentional schema change, then review its SQL.

PostgreSQL is the included cross-instance auth limiter. Redis is not required for this baseline; a
secondary store is an optional future optimization for broader API limiting or cache workloads and
must not become an authorization source of truth.

## Production checklist

- HTTPS URL and exact trusted origins match the deployed revision and app scheme.
- Secret is high entropy, stored in Secret Manager, and absent from logs/build layers.
- Cookie flags are verified in a real browser, including cross-origin behavior if applicable.
- Native deep links return to the correct app/environment.
- Email/password enablement matches product policy; email verification/recovery delivery is tested if
  exposed.
- Session revoke, sign-out, device reinstall, identity switch, and expired-session behavior pass.
- Organization creation limits, active-business selection, membership reload, wrong-business denial,
  and organization deletion protection pass before business data is enabled.
- Auth database migration and rollback compatibility are verified.

## Official sources

- [Better Auth installation and secret requirements](https://better-auth.com/docs/installation)
- [Better Auth security](https://better-auth.com/docs/reference/security)
- [Better Auth rate-limit storage](https://better-auth.com/docs/concepts/rate-limit)
- [Better Auth Hono integration](https://better-auth.com/docs/integrations/hono)
- [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth CLI](https://better-auth.com/docs/concepts/cli)
- [Better Auth Polar billing plugin](https://better-auth.com/docs/plugins/polar)
- [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization)
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
