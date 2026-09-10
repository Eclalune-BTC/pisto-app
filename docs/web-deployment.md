# Web deployment

## Current target and portable artifacts

The owner's 2026-09-10 instruction selects Neon PostgreSQL and avoids provider coupling.
[ADR 0017](adrs/0017-portable-postgres-and-hosting.md) records the decision. The initial publishing
adapter is Vercel; actual deployment status and checks live in [release evidence](release-evidence.md).

- `apps/app/dist`: ordinary Expo web files, using `web.output: "single"`.
- `apps/api/Dockerfile`: portable Bun/Hono server plus a separate bundled migration entrypoint.
- `api/server.ts`: minimal Vercel Bun entrypoint invoking the same API runtime.
- `api/tsconfig.json`: explicit Bun compiler settings and emitted relative-import rewriting;
  the function also retains package source files referenced by workspace TypeScript exports.
- `vercel.json`: routing, build, region, response headers and function duration for that adapter.
- `packages/db/migrations`: standard SQL/Drizzle history, using the existing `postgres` driver.

There is no Neon or Vercel SDK in domain code. Rehosting needs a static server and reverse proxy,
the API container, and a PostgreSQL URL; it does not require rewriting business features. The API
container does not serve the frontend itself. The GCP reference under `infra/gcp` remains optional.

## Configuration and build

Use Node 24.19 and Bun 1.4.0 with the committed lockfile and `patches` directory:

```sh
bun install --frozen-lockfile
bun run check
bun run test:integration
bun run audit:ci
bun run db:check
bun run auth:schema:check
```

Set `APP_VARIANT=production`, `EXPO_PUBLIC_API_URL` to the exact HTTPS product origin, the private
app scheme and explicit native identifiers before exporting. `EXPO_PUBLIC_*` values become public
bundle contents: never put credentials there. Changing them requires a new web export. Set
`BETTER_AUTH_URL`, `CORS_ORIGINS` and `TRUSTED_ORIGINS` to the intended same-origin HTTPS endpoint;
also allow the explicit native scheme in trusted origins. Preview domains must be enrolled explicitly.

Server-only secrets are `DATABASE_URL`, `BETTER_AUTH_SECRET` and any enabled provider credentials.
Runtime uses a pooled Neon connection, `DATABASE_SSL=verify-full`, a bounded connection budget,
and the restricted `pisto_app` role. Migrations use a separately held direct connection and owner role.
Apply migrations before traffic; do not run DDL during a function startup or a web build.

Keep billing disabled until its separate delivery gates pass. `PISTO_PRODUCT_WRITES_ENABLED=false`
pauses authenticated operating writes while preserving reads; apply that setting through a new
deployment when using immutable function environments. Read/write request budgets remain shared
across instances in PostgreSQL. Their window must stay 60 seconds because the auth limiter owns
cleanup of the shared operational table.

## Routing and cookies

The browser uses one origin for web files and the API. Route `/v1`, `/v1/(.*)`, `/api/auth/(.*)`,
`/health` and `/ready` to the API function before applying the SPA fallback. Vercel named captures
are forwarded as query parameters; use anonymous captures so strict API query schemas do not
receive an invented `path` parameter. Verify the runtime receives the original path and query.

Remaining application paths resolve to `/index.html`, including deep record/correction routes.
Existing assets are served directly. Missing `/_expo`, `/assets`, and file-extension paths must
return 404, not HTML. Unknown application routes reach Expo's not-found screen. No session or
private business data is embedded in the web export.

Same-origin HTTPS keeps Better Auth cookies host-only and avoids third-party-cookie dependence.
Native continues using the official SecureStore cookie adapter against the same API. Verify
sign-up, sign-in, authenticated reads, sign-out and expired-session behavior on the deployed host.

## Headers and caching

| Resource | Policy |
| --- | --- |
| Fingerprinted `/_expo/static` assets | One year, immutable |
| HTML and other route metadata | Revalidation; never immutable |
| Financial/authenticated API responses | `Cache-Control: no-store`, including failures |
| Missing files | Real 404 and correct content type |

The host adds `nosniff`, referrer policy, frame denial, and disables currently unused microphone,
camera and geolocation permissions. Revisit the last policy as part of an actual voice feature.
Verify CDN response headers rather than assuming configuration proves their delivery. The core
application has no offline mutation queue; an uncertain save must be reconciled before retrying.

## Release and rollback

1. Review changes, migration impact, runtime budgets, dependency exceptions and secrets separately.
2. Validate source, SQL integration, auth schema and the portable container; export native bundles
   when dependencies affect Expo Router or cross-platform behavior.
3. Apply forward migrations using the migration identity. Confirm runtime cannot create schema or
   delete financial records, and can perform the documented authenticated operating paths.
4. Deploy the reviewed source with its immutable lockfile and production environment. Keep the
   deployment ID, URL, commit and validation results in release evidence.
5. Smoke-test the public API and SPA, including authenticated strict-query lists and deep routes.
6. If necessary, restore the previous compatible application deployment. SQL constraints are forward
   migrations; application rollback must remain compatible with the current database. Never delete
   financial evidence or roll back a database just to undo a frontend release.

Migration scripts, private backups, `.env` files and local tooling must never enter the web output or
uploaded build context. `.vercelignore`, `.dockerignore` and explicit runtime COPY rules enforce this.
Do not enable purchases, change account plans or automatically promote the optional GCP candidate.

## Required live smoke checks

- `/health`, `/ready`, `/v1`, unauthenticated `/v1/me`, auth session endpoint, and malformed/unknown API paths.
- Register a clearly named QA account/business; perform a manual sale, retrieve it, and verify
  idempotent replay, history, permissions and sign-out. Keep production QA data clearly identified.
- Authenticated catalog listing with a real `search`/`limit` query, and rejection of unknown query keys.
- Fresh direct loads of `/sign-in`, `/business`, `/operate/reports`, `/operate/sales/new`,
  `/operate/sales/<id>`, and `/operate/receivables/<id>/payments/<id>/reverse`.
- Actual JS/CSS content types, missing-asset 404, HTML/API cache behavior and credentialed CORS.
- Compact and desktop web layouts, visible errors/loading states, keyboard access and confirmation.
- Bundle configuration for accidental localhost URLs or secrets. Native exports are build evidence;
  physical device tests and signed store releases remain separate gates.

## Moving providers

Export the PostgreSQL database with `pg_dump`, restore with `pg_restore`, recreate least-privilege
roles, then verify constraints, migration history and ledger totals before cutover. Deploy the
same container and web files behind a same-origin proxy. Update private/public origins and rebuild
the web artifact. Test cookie renewal and existing sessions, restore, and rollback before moving
real traffic. A backup/restore test is evidence; a configured backup switch alone is not.

## Public website boundary

The Expo app is the authenticated product. Add `apps/site` only when public editorial/SEO content
requires its own rendering, CMS or release lifecycle; do not add another frontend preemptively.

## Official sources reviewed 2026-09-10

- [Expo web publishing and output modes](https://docs.expo.dev/guides/publishing-websites/)
- [Vercel Bun runtime](https://vercel.com/docs/functions/runtimes/bun)
- [Vercel routing configuration](https://vercel.com/docs/project-configuration/vercel-json)
- [Neon pooling](https://neon.com/docs/connect/connection-pooling)
- [PostgreSQL backup and restore](https://www.postgresql.org/docs/current/backup-dump.html)
