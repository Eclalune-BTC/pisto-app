# ADR 0017: Portable PostgreSQL and hosting

- Status: Accepted under the owner's 2026-09-10 instruction to use Neon without vendor lock-in
- Supersedes: ADR 0008's mandatory Cloud SQL production target

## Decision

Use PostgreSQL 18 on Neon through the existing `postgres` driver, Drizzle and standard SQL migrations.
No Neon SDK, Neon Auth, provider-specific SQL, or proprietary data API enters the application.
Runtime uses a restricted database role and TLS; the migration role is separate. Direct connections
run migrations. Pooled connections can serve the API after transaction and connection tests.

Keep the Bun/Hono API container as the portable runtime artifact. The available Vercel account is
the initial web/API publishing target; Railway's existing trial rejected provisioning. The only
Vercel-specific application entrypoint is `api/server.ts`, which starts the same Hono runtime.
`vercel.json` owns hosting routing and limits. No domain feature imports a Vercel SDK.

Expo exports a single-page application (`web.output: single`), with host rewrites for deep links.
Static assets and financial/auth API routes share one browser origin. This preserves secure,
host-only SameSite cookies without depending on third-party-cookie settings. Native uses the same
HTTPS API and existing SecureStore adapter. The API container still does not serve web files.

## Consequences and exit path

- Web and API releases are coupled in this initial hosting adapter; domain/package ownership remains
  unchanged. A later host can serve `apps/app/dist` and proxy `/v1`, `/api/auth`, `/health`, and `/ready`
  to the API container using Nginx or another standard reverse proxy.
- Missing assets must return 404, not SPA HTML. Browser routes resolve to index.html and Expo Router.
- A database move uses `pg_dump`/`pg_restore`, SQL migrations, and new `DATABASE_URL` values. Validate
  constraints, timezone behavior, ledger totals and a restore before redirecting production traffic.
- Serverless scaling needs bounded per-instance pools and a deployment-specific connection budget.
- Vercel's managed Bun runtime is a beta and manages patches within `1.4.x`; Docker remains pinned
  to Bun 1.4.0. A successful local container does not prove the hosted adapter, and vice versa.
- Billing remains disabled. AI/voice, store distribution, email delivery and production operations
  require their own implementation and evidence; a public URL does not complete those capabilities.

## Sources reviewed 2026-09-10

- [Neon connection pooling](https://neon.com/docs/connect/connection-pooling)
- [Neon connection security](https://neon.com/docs/connect/connect-securely)
- [Vercel Bun runtime and API server entrypoints](https://vercel.com/docs/functions/runtimes/bun)
- [Expo web output modes](https://docs.expo.dev/guides/publishing-websites/)

Recheck on hosting/runtime changes, database moves, new external SDKs or native release.
