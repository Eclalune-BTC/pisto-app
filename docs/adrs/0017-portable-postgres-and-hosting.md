# ADR 0017: Local operation and portable PostgreSQL

- Status: Accepted; its "hosting remains undecided" clause is superseded by
  [ADR 0020](0020-cloudflare-workers-neon-hosting.md) (Cloudflare Workers and Neon, 2026-11-01)
- Scope: Local runtime, source publication and portable artifacts

## Decision

Run Expo, the Bun/Elysia API and PostgreSQL 18 locally. Use the existing postgres-js driver, Drizzle
schema and standard SQL migrations. Cloud provisioning, hosted deployment, provider activation and store submission are separate
decisions.
Hosting remains undecided. Do not use retained remote credentials for local startup or tests.

Neon is an optional future database preference, not a selected runtime dependency. A future database
or hosting choice needs a new explicit decision and environment-specific acceptance. No hosted
identity system, provider SQL API or deployment SDK is required by the current product.

## Portability and safety

The Bun/Elysia Docker image and Expo single-page web export are separate portable artifacts. Keep
runtime identity, secrets and migrations independent of a hosting vendor. A future shared environment
requires TLS, least-privilege runtime access, a separate migration identity, a bounded connection
budget and tested backup/restore. Do not migrate on API startup or infer pooler compatibility.

Web deep links must resolve to Expo Router; missing assets must return a real error. Validate
cookies, exact CORS/trusted origins and the client-IP contract for the selected topology. Standard
PostgreSQL dump/restore and reviewed migrations preserve records across a provider move.

Runtime instructions live in [getting started](../getting-started.md) and
[local runtime and portable artifacts](../local-runtime.md).

Historical hosting decisions and task transcripts are available in Git, not active agent guidance.
