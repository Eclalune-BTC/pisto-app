# Pisto Stack

Pisto is a business operating application for Spanish-speaking entrepreneurs, built in TypeScript
with an Expo Router client and a Bun/Elysia backend. The backend uses PostgreSQL 18 through Drizzle
and postgres-js, Better Auth for authentication, and shared Zod request/response contracts.
See [the backend composition](docs/architecture.md#backend-composition) for the source owners.

The configured application runs locally. Billing adapters exist but are disabled; native
purchases still require their separately accepted integration and store checks.

The active product direction is an AI-native operating assistant for Spanish-speaking entrepreneurs.
What exists today is the structured manual path: sales with void/replacement correction, catalog,
inventory movements, expenses, cash accounts and movements, and customers and receivables, all
reachable from an `/operate` module hub, alongside sale history and exact operating reports.
No AI dependency is installed in any manifest, so there is
no conversational or voice sale path yet, and `/dashboard` is only a redirect into `/operate`. Start
with [the documentation map](docs/README.md) and the
[product capability architecture](docs/product-capability-architecture.md) before adding a module or
changing navigation.

New total-only sales now use a server-owned review before confirmation. A reviewed sale can be
reopened after navigation or reload without saving financial drafts in browser storage or replaying
writes automatically. Apply migration `0006` before running this revision. See
[the recovery contract](docs/adrs/0018-durable-sale-review.md); corrections and other financial
editors are outside this first recovery slice.

Current [product requirements](docs/product-requirements.md), [UX requirements](docs/ux-requirements.md)
and [data model](docs/data-model.md) describe the implemented boundaries and remaining acceptance.
Expo, Bun/Elysia and PostgreSQL 18 run locally. GitHub source synchronization is authorized; cloud
provisioning, hosted deployment and store publication are separate decisions. The API container and
Expo web artifact remain portable. See [ADR 0017](docs/adrs/0017-portable-postgres-and-hosting.md)
and [release evidence](docs/release-evidence.md).

## Interface guidance

[The design system](docs/design-system.md) owns the current neutral palette, React Native Reusables
components, typography and spacing. Run the local app to inspect the current interface. Dated web
checks and physical-device acceptance limits are recorded in [release evidence](docs/release-evidence.md).

## Repository map

- apps/app: universal Expo application and platform-specific adapters
- apps/api: Bun/Elysia HTTP service
- packages/contracts: shared request, response, and error schemas
- packages/db: PostgreSQL schema, migrations, and repositories
- packages/auth: Better Auth server configuration
- packages/billing: Polar adapter and canonical entitlements
- scripts: safe setup and diagnostic CLI
- docs: architecture, setup, operations, security, and source links
- .agents/skills: repository-scoped Codex workflow for architecture-first product delivery
- infra/gcp: inactive reference scripts retained for credential-free CI safeguards; not a deployment plan

## Quick start

For the configured desktop checkout, follow
[the existing Windows workspace](docs/getting-started.md#existing-windows-workspace): it uses
`pisto-audit`, PostgreSQL port 55438, API port 3015 and Expo web port 8090, not the template defaults.
For styling, shadcn-style component ownership and Expo Go limits, read
[the frontend guide](docs/frontend-expo-ui.md#component-stack-and-cross-platform-rendering).

Requirements: Bun 1.4+, Node.js 24.19 LTS, Docker Desktop, and the Expo prerequisites for
the target platform. For a fresh checkout:

1. Run bun install --frozen-lockfile.
2. Run bun run setup.
3. Run docker compose up -d postgres.
4. Run bun run db:migrate.
5. Run bun run dev.

The setup command creates missing local environment files without overwriting existing
ones. Run bun run doctor whenever a local tool or service appears misconfigured.

## Validation

- bun run check validates formatting, lint rules, types, tests, and the Expo web export.
- bun run build builds all packages and applications.
- bun run verify adds environment diagnostics and real PostgreSQL integration tests; verify the test database target first.

Start with docs/README.md for the active product goal, engineering workflow, complete guide, and
primary-source references. Codex agents also load the root AGENTS.md and the repository-scoped skill
under `.agents/skills`.

## Billing boundary

Polar is the default checkout and customer portal for browser purchases. Native apps must
use Apple StoreKit or Google Play Billing for in-app digital goods where store rules apply.
Both paths write into the same internal entitlement model, so product code never trusts a
provider response directly.

## License

No project license has been selected. Add one before distributing the project outside your team.
