# ADR 0017: Local operation and portable PostgreSQL

- Status: Accepted
- Scope: Current runtime, source publication and future hosting boundary

## Decision

Run Expo, the Bun/Hono API and PostgreSQL 18 locally. Use the existing postgres-js driver, Drizzle
schema and standard SQL migrations. GitHub source synchronization is authorized by the owner; it
does not authorize cloud provisioning, hosted deployment, provider activation or store submission.
Hosting remains undecided. Do not use retained remote credentials for local startup or tests.

Neon is an optional future database preference, not a selected runtime dependency. A future database
or hosting choice needs a new explicit decision and environment-specific acceptance. No hosted
identity system, provider SQL API or deployment SDK is required by the current product.

## Portability and safety

The Bun/Hono Docker image and Expo single-page web export are separate portable artifacts. Keep
runtime identity, secrets and migrations independent of a hosting vendor. A future shared environment
requires TLS, least-privilege runtime access, a separate migration identity, a bounded connection
budget and tested backup/restore. Do not migrate on API startup or infer pooler compatibility.

Web deep links must resolve to Expo Router; missing assets must return a real error. Validate
cookies, exact CORS/trusted origins and the client-IP contract for the selected topology. Standard
PostgreSQL dump/restore and reviewed migrations preserve records across a provider move.

The inactive `infra/gcp` scripts remain exercised by credential-free CI tests. They are not the
application's selected architecture or an authorized deployment procedure. Their presence must not
trigger provisioning. Runtime instructions live in [getting started](../getting-started.md) and
[local runtime and portable artifacts](../web-deployment.md).

Historical hosting decisions and task transcripts are available in Git, not active agent guidance.
