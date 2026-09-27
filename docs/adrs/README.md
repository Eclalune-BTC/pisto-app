# Architecture decision records

ADRs retain consequential decisions that still guide Pisto. Keep current decisions and their useful
rationale here; Git preserves retired architecture and superseded wording. Do not keep abandoned
runbooks or completed task instructions as active guidance. Never recycle or renumber ADR identifiers.
For a genuinely new decision, add an ADR; reconciling old wording with an already accepted decision
should update the affected guide and references. Accepted target architecture is not shipped code.

## Index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-bun-typescript-monorepo.md) | Accepted | Bun and TypeScript workspace with explicit package boundaries |
| [0002](0002-expo-router-universal-client.md) | Accepted | Expo SDK 57 and Expo Router for Android, iOS, and web |
| [0003](0003-hono-bun-api.md) | Accepted | Hono API on Bun with transport-neutral contracts |
| [0004](0004-postgresql-drizzle-migrations.md) | Accepted | PostgreSQL 18 and reviewed Drizzle migrations |
| [0005](0005-better-auth.md) | Accepted | Centralized Better Auth with Hono and Expo adapters |
| [0006](0006-split-billing-channels.md) | Accepted | Polar web billing and RevenueCat/native store billing |
| [0007](0007-provider-neutral-entitlements.md) | Accepted | Provider-neutral paid-access model; product routes are not yet entitlement-gated |
| [0009](0009-provider-neutral-ai-assistant.md) | Accepted target; not implemented | Provider-neutral AI orchestration with deterministic business tools |
| [0010](0010-organization-backed-business-tenancy.md) | Accepted | Better Auth organization IDs back Pisto business tenant boundaries |
| [0011](0011-modular-capabilities-and-app-owned-composition.md) | Accepted | Product capabilities compose explicitly inside a modular monolith |
| [0012](0012-total-only-sales-increment.md) | Accepted | Total-only manual sales are the first persisted product increment |
| [0013](0013-es-sv-localization-boundary.md) | Accepted | Typed `es-SV` localization separates product copy from application logic |
| [0014](0014-static-current-operation-permissions.md) | Accepted | Static Pisto permissions authorize current business and sales operations |
| [0015](0015-business-owned-currency-and-money-snapshots.md) | Accepted | Business-owned currency and immutable money snapshots prevent global defaults and history rewrites |
| [0016](0016-owner-ports-for-cross-capability-transactions.md) | Accepted | Narrow owner ports keep cross-capability financial writes atomic without hiding ownership |
| [0017](0017-portable-postgres-and-hosting.md) | Accepted, revised | Local Expo, Bun/Hono, and PostgreSQL; future hosting remains undecided |
| [0018](0018-durable-sale-review.md) | Accepted | Server-owned recovery for reviewed new sales without client-side financial storage |

## Status values

- **Proposed**: under review; implementation must not depend on it yet.
- **Accepted**: current architecture.
- **Superseded**: replaced by a named later ADR.
- **Deprecated**: retained for compatibility but not for new work.
- **Rejected**: considered and intentionally not selected.

## Template

```markdown
# ADR NNNN: Decision title

- Status: Proposed
- Date: YYYY-MM-DD
- Owners: relevant workspace/team
- Supersedes: none

## Context
## Decision
## Consequences
## Alternatives considered
## Validation
## Official sources
```

An ADR that relies on changeable external behavior records its research date and a mandatory recheck
trigger. Library-versus-build evidence belongs under `Alternatives considered` when it affects the
decision. An implementation detail that does not alter a boundary usually belongs in the relevant
guide rather than a new ADR.
