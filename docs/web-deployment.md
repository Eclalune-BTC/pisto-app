# Local runtime and portable artifacts

## Current local workflow

Expo, Bun/Hono and PostgreSQL 18 run locally. GitHub source synchronization is authorized; hosting,
provider activation and store publication require separate approval. No hosted database or platform
SDK is required for local startup. See [ADR 0017](adrs/0017-portable-postgres-and-hosting.md).

The commands below are for a fresh checkout. Use
[the configured Windows workspace](getting-started.md#existing-windows-workspace) for the existing
pisto-audit database and its nondefault ports; do not create another database project there.

Use the committed Bun version and local setup workflow:

```sh
bun install --frozen-lockfile
bun run setup
bun run doctor
docker compose up -d postgres
bun run db:migrate
bun run dev
```

Setup creates missing environment files without replacing existing ones. Review local targets before
starting services or migrating: the API's `DATABASE_URL` must point to the intended local PostgreSQL
instance, and `EXPO_PUBLIC_API_URL` must point to the local API. The normal API development origin is
`http://localhost:3001`; use the local Expo URL printed at startup. When another local database already
uses a port, keep the chosen Compose project and host-port mapping explicit instead of stopping or
replacing that database. The current verified mapping is recorded in release evidence.

For a physical device, a reviewed reachable local-network API address may replace `localhost`.
Keep the API/client origins and native scheme consistent. Do not add remote services merely to test
a local UI. Native device acceptance remains separate from web or bundle verification.

## Portable artifacts and local validation

- `apps/app/dist`: ordinary Expo web files using `web.output: single`.
- `apps/api/Dockerfile`: portable Bun/Hono API and separate bundled migration entrypoint.
- `packages/db/migrations`: standard PostgreSQL/Drizzle migration history.
- `infra/gcp`: inactive reference scripts with credential-free CI tests; not a selected runtime or work order.

No provider-specific web entrypoint, publishing configuration or host SDK is required. The API container does
not serve web files. The exported client remains independent of API hosting and can be inspected
with a local static server that implements SPA deep links and correct asset responses.

```sh
bun run check
bun run test:integration
bun run audit:ci
bun run db:check
bun run auth:schema:check
```

Run database checks only after verifying the local connection target. Local check/build/export
success is not a hosted deployment, native binary, device test, or store release.

`bun run smoke:local` exercises the real local sign-up/business/sale/replay/void/sign-out workflow.
It creates explicitly named QA records, revokes its session, and retains its voided sale as evidence.
Set `SMOKE_API_URL` and `SMOKE_WEB_ORIGIN` for nondefault local ports; see the exact current command
in [local delivery evidence](release-evidence.md#validation). It refuses remote origins, redirects
and configured HTTP proxies; it is not a hosted acceptance command.

`EXPO_PUBLIC_*` values become public bundle contents; never put credentials there. Changing the
public API URL requires a new export. Keep `DATABASE_URL`, `BETTER_AUTH_SECRET`, private backups,
and any retained provider credentials outside source control and client output. `.dockerignore`
and explicit Docker COPY rules protect the container build context; private tooling and environment
files must remain excluded from any future publishing workflow too.

Keep billing disabled until separately accepted. `PRODUCT_WRITES_ENABLED=false` pauses authenticated
business writes while preserving reads. Restart the local API after changing server configuration.
Read/write budgets remain in local PostgreSQL, with the same 60-second window as Better Auth's
cleanup of the shared operational rate-limit table.

## Future hosting conditions

The following checklist is retained for a later explicitly approved hosting decision. It does not
select a provider, authorize provisioning, or call for publishing the current branch.

### Routing and cookies

A standard static server and reverse proxy can place the web files and API behind one HTTPS origin.
Route `/v1`, `/v1/(.*)`, `/api/auth/(.*)`, `/health`, and `/ready` to the API before the SPA fallback.
The proxy must preserve original paths and query parameters; never inject routing-capture fields
into strict application query schemas.

Application deep links resolve to `/index.html` and Expo Router. Existing assets are served directly.
Missing asset/file-extension paths return 404, not HTML. Unknown application routes reach Expo's
not-found screen. Never embed sessions or private business records in exported HTML.

A same-origin HTTPS topology can keep host-only cookies without third-party-cookie dependence.
Separate-origin hosting requires an explicit cookie/CORS/trusted-origin review. Native retains the
SecureStore cookie adapter. Set exact public/server origins and test sign-in, renewal, sign-out,
expired-session behavior, and deep links in the selected environment before accepting a future host.

### Headers and caching

| Resource | Future-host requirement |
| --- | --- |
| Fingerprinted `/_expo/static` assets | Long-lived immutable cache |
| HTML and route metadata | Revalidation; never immutable |
| Financial/authenticated API responses | `Cache-Control: no-store`, including failures |
| Missing files | Real 404 and correct content type |

Review security headers and currently unused browser permissions with the actual feature set.
Verify delivered response headers, not just a host configuration file. There is no offline mutation
queue; reconcile an uncertain save before retrying.

### Migration, acceptance, and rollback

1. Obtain the explicit hosting decision and record its scope before provisioning or publishing.
2. Review secrets, budgets, dependencies, migrations, origins, and operational ownership.
3. Validate the portable artifacts and database upgrade; use a separate migration identity and a
   direct connection for a future shared database. Runtime startup must not run DDL.
4. Record the approved artifact, environment, release ID, local checks, hosted checks, and remaining
   gates independently in release evidence.
5. Verify health/readiness, auth, strict-query lists, mutation confirmation/replay, deep routes,
   missing assets, responsive layouts, keyboard access, and truthful error states.
6. Keep a compatible application rollback path. Database correction uses reviewed forward migrations;
   never delete financial evidence simply to undo a frontend release.

A production-configured artifact requires an exact HTTPS public API origin and explicit app
identifiers. Those requirements do not replace the current local development configuration.

## PostgreSQL portability

Use standard `pg_dump` and `pg_restore`, retain private backups, and restore into an isolated target.
Recreate least-privilege roles and verify constraints, migration history, and ledger totals before a
future database move. The prior export/restore proof is historical evidence in the release record;
it does not select a hosted database or establish a recovery SLA.

## Public website boundary

The Expo app is the authenticated product. Add `apps/site` only when public editorial/SEO content
requires its own rendering, CMS, or release lifecycle; do not add another frontend preemptively.

## Official sources

- [Expo web publishing and output modes](https://docs.expo.dev/guides/publishing-websites/)
- [PostgreSQL backup and restore](https://www.postgresql.org/docs/18/backup-dump.html)
- [Drizzle migration fundamentals](https://orm.drizzle.team/docs/migrations)
