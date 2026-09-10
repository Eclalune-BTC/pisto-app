# ADR 0017: Local operation and portable PostgreSQL

- Status: Revised after the owner's 2026-09-10 correction: everything local, no Vercel publication
- Supersedes: This ADR's earlier hosted-runtime decision and ADR 0008's mandatory Cloud SQL target

## Current decision

Run Expo, the Bun/Hono API, and PostgreSQL 18 locally. The API and integration tests use the local
PostgreSQL instance through the existing `postgres` driver, Drizzle, and standard SQL migrations.
Hosting is undecided and publication is not authorized. No provider-specific runtime entrypoint,
publishing configuration, or hosted database is required for the current application.

Neon remains the owner's optional future PostgreSQL preference if a hosted database is explicitly
requested later. It is not the active runtime database. Do not add a Neon SDK, Neon Auth,
provider-specific SQL, or proprietary data API. Retained remote credentials or prior infrastructure
are not permission to use a remote database for local development or tests.

Keep the Bun/Hono container and ordinary Expo web export portable. Expo's `web.output: single`
produces a single-page application that can be inspected locally; producing that artifact does not
publish it. The API container remains independent of web-file delivery.

## Correction and evidence

The earlier hosting interpretation led to an unwanted publication attempt. The owner corrected the
scope to local-only and rejected Vercel hosting. That interpretation is withdrawn. The integration
owner records resource deletion and public-endpoint verification in
[Release evidence](../release-evidence.md); this ADR does not infer removal from a local code change
or claim that the earlier remote application passed acceptance.

The previously provisioned remote database is outside the active environment. Any future use or
removal is an explicit operational decision, separate from local application startup.

## Portability and future hosting conditions

These are design constraints for a future approved change, not a publishing plan:

- A standard static server can serve `apps/app/dist`; a reverse proxy can send `/v1`, `/api/auth`,
  `/health`, and `/ready` to the portable API container. No domain package depends on a host SDK.
- A future same-origin HTTPS proxy is one way to keep host-only cookies without third-party-cookie
  dependence. A separate-origin topology requires its own cookie, CORS, and trusted-origin review.
- Browser deep links must resolve to Expo Router; missing assets must return 404, not SPA HTML.
- A database move uses `pg_dump`/`pg_restore`, committed migrations, and changed connection
  configuration. Verify constraints, migration history, ledger totals, and restore behavior first.
- Direct connections run migrations and backup/restore tools. Any future pooler requires transaction
  tests and a bounded connection budget. Shared environments require separate runtime/migration roles
  and verified TLS behavior.
- The Google Cloud reference remains optional. It neither chooses a future provider nor authorizes
  provisioning or deployment.
- Billing, AI/voice, email delivery, team workflows, and native store distribution retain their
  separate implementation and acceptance gates.

## Sources

- [PostgreSQL backup and restore](https://www.postgresql.org/docs/18/backup-dump.html)
- [Drizzle migration fundamentals](https://orm.drizzle.team/docs/migrations)
- [Expo web output modes](https://docs.expo.dev/guides/publishing-websites/)
- [Neon connection pooling, if considered later](https://neon.com/docs/connect/connection-pooling)

Recheck provider-specific guidance only when a future hosting or database decision requires it.
