# ADR 0003: Hono API on Bun

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/api`, `@pisto/contracts`
- Supersedes: none

## Context

The project needs a small standards-based HTTP API that composes auth, database, and billing packages,
runs locally on Bun, and packages cleanly as a Cloud Run container. Public data contracts must not be
database/provider SDK types.

## Decision

Use Hono 4 on Bun. `@pisto/api` owns middleware and HTTP mapping; `@pisto/contracts` owns Zod-backed
transport schemas. Mount Better Auth's Web Standard handler at `/api/auth/*`, version product routes
under `/v1`, and expose separate non-mutating liveness/readiness probes.

Use exact credentialed CORS origins, secure headers, centralized error envelopes/request IDs, bounded
input, and `0.0.0.0:$PORT` in Cloud Run.

## Consequences

- Web Standard Request/Response simplifies in-process tests and Better Auth mounting.
- Hono remains an edge adapter; domain packages avoid framework context types.
- Contract evolution requires deliberate version compatibility.
- Runtime-specific behavior is concentrated in the listener/deployment edge.

## Alternatives considered

- Express/Fastify: mature but unnecessary Node-specific surface for this Bun/Web Standard baseline.
- Expo API routes: would couple API scaling/security/deployment to the UI workspace.
- Provider/database calls directly from app: violates secret and authorization boundaries.

## Validation

- in-process route contract tests
- CORS/auth/error tests
- container starts and answers probes on injected `PORT`
- `bun --filter @pisto/api typecheck`
- `bun --filter @pisto/api test`
- `bun --filter @pisto/api build`

## Official sources

- [Hono Bun guide](https://hono.dev/docs/getting-started/bun)
- [Hono validation](https://hono.dev/docs/guides/validation)
- [Hono CORS](https://hono.dev/docs/middleware/builtin/cors)
- [Cloud Run container contract](https://cloud.google.com/run/docs/container-contract)
