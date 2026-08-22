# ADR 0005: Better Auth for centralized authentication

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/auth`
- Supersedes: none

## Context

Web and native clients need one user/session model with a PostgreSQL adapter, Hono integration, Expo
cookie storage/deep links, origin/CSRF protections, and extensibility for organizations and billing.
Building password hashing/session/token protocols locally would add avoidable security risk.

## Decision

Use Better Auth 1.7.1 in `@pisto/auth`, mounted through Hono at `/api/auth/*`, with its Drizzle schema
owned by `@pisto/db` and official Expo adapter for native session storage. Use a 32-byte-or-greater
secret, exact trusted origins, secure cookies in production, and documented secret rotation.

Use Better Auth's PostgreSQL-backed rate-limit storage so counters are shared across Cloud Run
instances. Keep the synchronized `better-auth`, `@better-auth/expo`, and `auth` CLI packages aligned;
the accepted baseline is 1.7.1 for all three.

The Polar Better Auth plugin is used only as a billing integration; it does not make Polar the Pisto
identity provider.

## Consequences

- Authentication security behavior follows a maintained framework and official integrations.
- Auth/plugin upgrades can change schema and require reviewed migrations/session tests.
- Origin, scheme, cookie, and client storage configuration must stay synchronized.
- Disabling CSRF/origin checks is prohibited as a troubleshooting shortcut.

## Alternatives considered

- Custom auth: full control with high cryptographic/session/security maintenance cost.
- Platform-only identity: fragments web/native accounts and does not solve API sessions.
- Managed external identity vendor: viable later, but adds external account/data/deployment dependency.

## Validation

- web and native sign-in/sign-out/session expiry/revoke
- CSRF, untrusted-origin, credentialed CORS, and rate-limit cases
- Better Auth schema migration and existing-session compatibility
- deep-link and account-switch behavior

## Official sources

- [Better Auth installation](https://better-auth.com/docs/installation)
- [Better Auth security](https://better-auth.com/docs/reference/security)
- [Better Auth Hono](https://better-auth.com/docs/integrations/hono)
- [Better Auth Expo](https://better-auth.com/docs/integrations/expo)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [Better Auth rate limits](https://better-auth.com/docs/concepts/rate-limit)
- [Better Auth CLI](https://better-auth.com/docs/concepts/cli)
