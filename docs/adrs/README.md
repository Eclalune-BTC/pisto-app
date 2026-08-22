# Architecture decision records

ADRs preserve why a consequential decision was made. They are append-only history: when a decision
changes, add a new ADR that supersedes the old one instead of rewriting the old context.

## Index

| ADR | Status | Decision |
| --- | --- | --- |
| [0001](0001-bun-typescript-monorepo.md) | Accepted | Bun and TypeScript workspace with explicit package boundaries |
| [0002](0002-expo-router-universal-client.md) | Accepted | Expo SDK 57 and Expo Router for Android, iOS, and web |
| [0003](0003-hono-bun-api.md) | Accepted | Hono API on Bun with transport-neutral contracts |
| [0004](0004-postgresql-drizzle-migrations.md) | Accepted | PostgreSQL 18 and reviewed Drizzle migrations |
| [0005](0005-better-auth.md) | Accepted | Centralized Better Auth with Hono and Expo adapters |
| [0006](0006-split-billing-channels.md) | Accepted | Polar web billing and RevenueCat/native store billing |
| [0007](0007-provider-neutral-entitlements.md) | Accepted | Internal entitlements are the authorization boundary |
| [0008](0008-google-cloud-managed-runtime.md) | Accepted | Cloud Run and managed Google Cloud supporting services |

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

An ADR that relies on store or regulatory policy records its research date and a mandatory recheck
trigger. An implementation detail that does not alter a boundary usually belongs in the relevant
guide rather than a new ADR.
