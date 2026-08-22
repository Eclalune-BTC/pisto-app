# Pisto Stack documentation

Pisto Stack is a Bun and TypeScript monorepo for a universal Expo application, a Hono API,
PostgreSQL persistence, Better Auth, and provider-neutral paid access. The browser checkout uses
Polar. Native iOS and Android purchases must use the platform stores through RevenueCat once that
release-gated SDK integration is installed; the baseline native adapter is disabled. The production
target is Google Cloud Run with Cloud SQL and explicitly provisioned supporting managed services.

The approved product direction is Pisto: an AI-native operating assistant for Spanish-speaking
entrepreneurs. It will turn conversational text and later short voice notes into reviewable business
operations and answer questions through deterministic domain queries. AI is an interface and
orchestration layer; PostgreSQL remains the business source of truth.

These documents describe the intended engineering and operating contract. They do not claim that a
feature is deployed merely because its code or design exists.

## Current product state

Pisto currently includes a universal authenticated application shell, email/password sign-up/sign-in
wiring, a session-backed account summary, API health/readiness, and server-backed billing catalog and
entitlement paths. Polar web checkout/portal behavior is available only when configured.

No sales, inventory, expenses, financial accounts, obligations, goals, assistant route, model
provider, voice flow, RAG, graph, monthly computation, or activity history exists in this baseline.
The first product job is approved but not implemented. Dashboard planning items are guidance, not
stored product state. Email verification/recovery delivery, a finished organization/roles workflow,
native purchases, and provisioned production cloud resources remain incomplete or release-gated;
see [Production capabilities](production-capabilities.md).

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
| AI assistant | AI SDK 7 target, provider-neutral Pisto tools; not installed | `docs/ai-assistant.md` and ADR 0009 |
| Production runtime | Docker image on Cloud Run | Deployment configuration and immutable image digest |

## Reading order

1. [Active product goal](product-goal.md) states the current milestone and blocks invented scope.
2. [Approved product brief](product-briefs/pisto-ai-business-assistant.md) defines Pisto and the first
   conversational sale/report slice.
3. [Engineering workflow](engineering-workflow.md) defines research, reuse, architecture, review,
   and completion evidence.
4. [AI assistant architecture](ai-assistant.md) records model, tools, voice, retrieval, evaluation,
   and provider portability decisions.
5. [Reusable agent feature prompt](agent-feature-prompt.md) frames bounded Codex or Claude Code work.
6. [Architecture](architecture.md) explains boundaries and request flows.
7. [Repository layout](repository-layout.md) says where changes belong.
8. [Getting started](getting-started.md) takes a new checkout to a verified local environment.
9. [CLI workflow](cli-workflow.md) documents the safe `init`, `doctor`, and `help` commands.
10. [Expo and UI](frontend-expo-ui.md) covers routes, responsive UI, client configuration, and
   platform boundaries.
11. [Web deployment](web-deployment.md) separates the Expo static host from the API runtime.
12. [API and Hono](api-hono.md) defines the HTTP composition and route conventions.
13. [PostgreSQL and Drizzle](database-drizzle.md) defines schema and migration policy.
14. [Better Auth](authentication.md) defines sessions, origins, and secret handling.
15. [Billing and entitlements](billing-entitlements.md) is the normative purchase and access model.
16. [Google Cloud deployment](cloud-deployment.md) describes the production topology.
17. [Production capabilities](production-capabilities.md) separates included code from future seams.
18. [Security](security.md) is the security baseline and review checklist.
19. [Testing and release](testing-release.md) defines evidence required before release.
20. [Versioning and upgrades](versioning-upgrades.md) defines dependency and migration policy.
21. [Official source index](source-index.md) maps every major decision to primary documentation.
22. [Architecture decision records](adrs/README.md) preserve the reasoning behind the design.

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
- Model output never becomes an authoritative business fact. Financial mutations require typed
  confirmation, fresh server authorization, deterministic validation, idempotency, and audit.
- Transactional questions use authorized relational queries. RAG, pgvector, Neo4j, GraphRAG, and
  silent provider fallback are excluded until their documented evidence gates are met.
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
