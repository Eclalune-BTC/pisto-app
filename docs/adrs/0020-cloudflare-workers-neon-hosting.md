# ADR 0020: Cloudflare Workers and Neon for the hosted demo

- Status: Accepted (2026-11-01)
- Scope: Hosted environment for the public demo; supersedes the "hosting undecided" part of
  [ADR 0017](0017-portable-postgres-and-hosting.md)

## Decision

Host the MVP on Cloudflare Workers with the existing Neon PostgreSQL 18 database (AWS us-east-1).
One Worker named `pisto` serves the Expo web export as static assets and forwards `/api/*`, `/v1`,
`/v1/*`, `/health` and `/ready` to a single `ApiServer` Durable Object, which runs the unchanged
Elysia application. The Bun server and Docker image remain the local runtime.

## Why a Durable Object

A stateless Worker may not reuse an I/O object, such as a PostgreSQL socket, across requests, so a
regular Worker would open a database connection per request. A Durable Object keeps one I/O context
for every request it serves. That lets the API keep its bounded postgres-js pool and hold the
realtime WebSockets in memory, exactly like the Bun process. The object is placed in eastern North
America (`locationHint: "enam"`) next to the database. One instance is enough for demo traffic;
it serializes nothing but JavaScript execution, and database I/O stays concurrent.

## Runtime constraints this introduced

- Workers forbid generating code from strings during a request. Elysia compiles every route at
  module start through its Cloudflare adapter, and Zod runs `jitless`.
- Workers have no `Temporal`; business-local times are resolved with `Intl` (same DST tests).
- Auth rate limits key on `cf-connecting-ip` (`AUTH_IP_ADDRESS_HEADER`), which Cloudflare sets.
- HTTPS makes Better Auth prefix cookies with `__Secure-`; the API collection accepts both names.

## Identities and secrets

`pisto_migrator` owns the schema and applies migrations over the direct (non-pooler) endpoint.
`pisto_app` is the runtime role: SELECT/INSERT/UPDATE by default privilege and DELETE only on the
eight Better Auth tables, so financial records cannot be deleted by the application. The Worker
receives `DATABASE_URL` (runtime role) and `BETTER_AUTH_SECRET` as Cloudflare secrets; no secret is
committed. Operational steps live in [the deployment runbook](../deployment-cloudflare.md).

## Consequences

- The hosted URL is `https://pisto.contact-862.workers.dev`; billing stays disabled.
- Deploying a new version restarts the Durable Object, which drops open realtime sockets; clients
  reconnect with backoff.
- The same database serves the demo, so `bun run db:seed` loads its demo users once. Backups rely
  on Neon's own history until a retention policy is chosen; no production recovery objective is
  claimed.
