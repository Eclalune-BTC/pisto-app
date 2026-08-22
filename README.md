# Pisto Stack

Pisto Stack is a production-oriented starter for one TypeScript product across iOS,
Android, and the web. It combines an Expo Router application with a Bun/Hono API,
PostgreSQL and Drizzle, Better Auth, provider-neutral entitlements, web billing through
Polar, and native purchase boundaries for the Apple App Store and Google Play.

The repository is intentionally built from source instead of cloned from another starter.
Every integration is replaceable behind a small package boundary.

## Repository map

- apps/app: universal Expo application and platform-specific adapters
- apps/api: Bun/Hono HTTP service
- packages/contracts: shared request, response, and error schemas
- packages/db: PostgreSQL schema, migrations, and repositories
- packages/auth: Better Auth server configuration
- packages/billing: Polar adapter and canonical entitlements
- scripts: safe setup and diagnostic CLI
- docs: architecture, setup, operations, security, and source links
- infra/gcp: Cloud Build and Cloud Run deployment reference

## Quick start

Requirements: Bun 1.4+, Node.js 24.19 LTS, Docker Desktop, and the Expo prerequisites for
the target platform.

1. Run bun install.
2. Run bun run setup.
3. Run docker compose up -d postgres.
4. Run bun run db:migrate.
5. Run bun run dev.

The setup command creates missing local environment files without overwriting existing
ones. Run bun run doctor whenever a local tool or service appears misconfigured.

## Validation

- bun run check validates formatting, lint rules, types, and tests.
- bun run build builds all packages and applications.
- bun run verify adds environment diagnostics before the full validation.

Start with docs/README.md for the complete guide and primary-source references.

## Billing boundary

Polar is the default checkout and customer portal for browser purchases. Native apps must
use Apple StoreKit or Google Play Billing for in-app digital goods where store rules apply.
Both paths write into the same internal entitlement model, so product code never trusts a
provider response directly.

## License

No license has been selected. Add one before distributing the template outside your team.
