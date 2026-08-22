# Pisto Stack documentation

Pisto Stack is a Bun and TypeScript monorepo for a universal Expo application, a Hono API,
PostgreSQL persistence, Better Auth, and provider-neutral paid access. The browser checkout uses
Polar. Native iOS and Android purchases must use the platform stores through RevenueCat once that
release-gated SDK integration is installed; the baseline native adapter is disabled. The production
target is Google Cloud Run with Cloud SQL and explicitly provisioned supporting managed services.

These documents describe the intended engineering and operating contract. They do not claim that a
feature is deployed merely because its code or design exists.

## System map

| Area | Choice | Source of truth |
| --- | --- | --- |
| Runtime and package manager | Bun 1.4.0 | Root `package.json` and `bun.lock` |
| Universal client | Expo SDK 57 and Expo Router | `apps/app` |
| HTTP API | Hono on Bun | `apps/api` |
| Transport contracts | Provider-neutral TypeScript schemas | `packages/contracts` |
| Database | PostgreSQL 18 with Drizzle ORM | `packages/db` and committed migrations |
| Authentication | Better Auth 1.7.1 | `packages/auth` |
| Billing and access | Polar for web; native stores through RevenueCat | `packages/billing` |
| Production runtime | Docker image on Cloud Run | Deployment configuration and immutable image digest |

## Reading order

1. [Architecture](architecture.md) explains boundaries and request flows.
2. [Repository layout](repository-layout.md) says where changes belong.
3. [Getting started](getting-started.md) takes a new checkout to a verified local environment.
4. [CLI workflow](cli-workflow.md) documents the safe `init`, `doctor`, and `help` commands.
5. [Expo and UI](frontend-expo-ui.md) covers routes, responsive UI, client configuration, and
   platform boundaries.
6. [Web deployment](web-deployment.md) separates the Expo static host from the API runtime.
7. [API and Hono](api-hono.md) defines the HTTP composition and route conventions.
8. [PostgreSQL and Drizzle](database-drizzle.md) defines schema and migration policy.
9. [Better Auth](authentication.md) defines sessions, origins, and secret handling.
10. [Billing and entitlements](billing-entitlements.md) is the normative purchase and access model.
11. [Google Cloud deployment](cloud-deployment.md) describes the production topology.
12. [Production capabilities](production-capabilities.md) separates included code from future seams.
13. [Security](security.md) is the security baseline and review checklist.
14. [Testing and release](testing-release.md) defines evidence required before release.
15. [Versioning and upgrades](versioning-upgrades.md) defines dependency and migration policy.
16. [Official source index](source-index.md) maps every major decision to primary documentation.
17. [Architecture decision records](adrs/README.md) preserve the reasoning behind the design.

## Non-negotiable invariants

- Client bundles receive only public configuration. Database credentials, Better Auth secrets,
  Polar credentials, webhook secrets, and Google service credentials remain server-side.
- A native app never opens a Polar web checkout to unlock digital functionality. Apple and Google
  store policy can vary by storefront and program, so every mobile release includes a current policy
  review.
- Product identifiers do not grant access directly. Verified provider state is normalized to an
  internal entitlement and the API makes the final authorization decision.
- Webhooks are authenticated, idempotent, retried, and allowed to arrive out of order.
- Database migrations are reviewed artifacts. Production does not use schema push and the API does
  not run migrations during startup.
- The local CLI is repeatable: it never overwrites an environment file, starts a service, or mutates
  an external system.

## Fast path

```sh
bun install --frozen-lockfile
bun run setup
bun run doctor
docker compose up -d postgres
bun run db:migrate
bun run dev
```

Review generated local configuration before starting anything. On Windows PowerShell systems that
block the `bun.ps1` shim, use `bun.cmd` in place of `bun`.

## Documentation status

The official links were researched on **2026-08-22**. Store billing policy and cloud/product
behavior can change independently of this repository. Run the repeatable audit in
[Versioning and upgrades](versioning-upgrades.md#repeatable-upgrade-audit) before a release or major
upgrade.

## Primary foundations

- [Bun workspaces](https://bun.sh/docs/pm/workspaces)
- [Expo SDK reference and compatibility matrix](https://docs.expo.dev/versions/latest/)
- [Hono getting started](https://hono.dev/docs/getting-started/basic)
- [Drizzle migration fundamentals](https://orm.drizzle.team/docs/migrations)
- [Better Auth installation](https://better-auth.com/docs/installation)
- [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract)
