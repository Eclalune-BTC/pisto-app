# Getting started

## Prerequisites

- Bun **1.4.0 or newer**. The repository pins `bun@1.4.0` in `package.json`.
- Node.js **24.19.0 within major 24**; `package.json` requires `>=24.19.0 <25` and `.node-version`
  pins 24.19.0. Expo SDK 57's documented floor is 22.13.x, but the repository intentionally uses the
  narrower current-LTS baseline.
- Docker with the Compose plugin for local PostgreSQL 18.
- Git.
- For device work: Android Studio for Android, or macOS and Xcode for iOS.
- A recent browser for the web target.

The baseline does not require Polar, RevenueCat, Apple, Google Play, or Google Cloud credentials to
run with billing disabled.

## First checkout

Run commands from the repository root:

```sh
bun install --frozen-lockfile
bun run setup
bun run doctor
```

`setup` creates `.env` and `apps/app/.env.local` only when missing. It generates a high-entropy local
`BETTER_AUTH_SECRET` and does not print it. Review both files before continuing. Re-running setup
preserves existing files byte-for-byte.

On a Windows machine where PowerShell blocks the `bun.ps1` shim, use:

```powershell
bun.cmd install --frozen-lockfile
bun.cmd run setup
bun.cmd run doctor
```

## Start local dependencies

The CLI deliberately does not start Docker. Start only PostgreSQL yourself:

```sh
docker compose up -d postgres
docker compose ps
```

Apply committed migrations after PostgreSQL becomes healthy:

```sh
bun run db:migrate
```

Use `db:generate` only after intentionally changing the Drizzle schema. Review generated SQL before
applying it. `db:push` is a disposable local-prototyping tool and is not a production deployment
mechanism.

## Start the application

Run both persistent development tasks:

```sh
bun run dev
```

Or run one surface:

```sh
bun run dev:api
bun run dev:app
```

Expected local endpoints:

| Surface | Default |
| --- | --- |
| API | `http://localhost:3001` |
| Liveness | `http://localhost:3001/health` |
| Readiness | `http://localhost:3001/ready` |
| API version marker | `http://localhost:3001/v1` |
| Expo dev server | Usually `http://localhost:8081` |

Expo can open web from its terminal UI. Android emulators can usually reach the host through
`10.0.2.2`; a physical device needs a reachable LAN or HTTPS development URL. Set
`EXPO_PUBLIC_API_URL` accordingly rather than teaching application code environment-specific hosts.

## Local configuration

### Server and Compose reference

| Variable | Local purpose |
| --- | --- |
| `NODE_ENV` | Select development/test/production validation behavior |
| `API_HOST`, `API_PORT` | Bind the Hono service; defaults are `0.0.0.0:3001`; Cloud Run `PORT` wins |
| `PORT` | Platform-injected listener port; overrides `API_PORT` when present |
| `API_REQUEST_BODY_LIMIT_BYTES` | Hono body limit, 1,024 through 10,485,760 bytes |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT` | Local Compose container only |
| `DATABASE_URL` | PostgreSQL connection URL |
| `DATABASE_MAX_CONNECTIONS` | Process pool size, 1 through 100 |
| `DATABASE_CONNECT_TIMEOUT_SECONDS` | Connection timeout, 1 through 60 seconds |
| `DATABASE_IDLE_TIMEOUT_SECONDS` | Idle timeout, 1 through 600 seconds |
| `DATABASE_SSL` | `disable` for Compose; production chooses `prefer`, `require`, or `verify-full` deliberately |
| `BETTER_AUTH_SECRET` | At least 32 high-entropy characters |
| `BETTER_AUTH_SECRETS` | Optional comma-separated `version:value` rotation set with unique positive versions |
| `BETTER_AUTH_URL` | Public origin of the auth server |
| `CORS_ORIGINS` | Exact browser origins allowed by Hono |
| `TRUSTED_ORIGINS` | Exact web origins and approved application schemes for Better Auth |
| `EXPO_SCHEME` | Private app scheme used to add Better Auth deep-link origins |
| `AUTH_EMAIL_PASSWORD_ENABLED` | Explicit email/password switch |
| `AUTH_TRUSTED_PROXY_HEADERS` | Trust forwarded headers only behind a reviewed proxy boundary |
| `BILLING_ENABLED` | Keep `false` until a provider sandbox is deliberately configured |
| `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET` | Server-only Polar credentials |
| `POLAR_SERVER` | `sandbox` or `production` |
| `POLAR_PRODUCTS_JSON` | Strict non-empty product array with UUID, slug, entitlement key, and optional display text |
| `POLAR_SUCCESS_URL`, `POLAR_RETURN_URL` | Browser return URLs; production requires HTTPS and a non-reserved hostname |
| `POLAR_THEME` | Optional `light` or `dark` checkout theme |
| `REVENUECAT_ENABLED` | Keep `false` until the native webhook projection is configured |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Required server-side webhook Authorization value when enabled |
| `REVENUECAT_WEBHOOK_SIGNING_SECRET` | Optional HMAC signing secret; verification uses the raw request body |
| `REVENUECAT_SIGNATURE_TOLERANCE_SECONDS` | HMAC timestamp tolerance, 30 through 3,600 seconds |
| `REVENUECAT_ENTITLEMENT_MAP_JSON` | Non-empty RevenueCat-to-internal-entitlement object |

The root `.env.example` is the canonical exact-name reference. A production setting being
syntactically valid does not prove its credential, domain, product, or provider resource exists.
Production URL validation rejects localhost/loopback, reserved TLDs, and `example.com`,
`example.net`, and `example.org` (including subdomains).

### Client reference

`EXPO_PUBLIC_API_URL` is compiled into the app. Any `EXPO_PUBLIC_*` value is public and extractable
from a built binary or web bundle. Do not put `BETTER_AUTH_SECRET`, database credentials, Polar
tokens, webhook secrets, or Google service credentials in the client file.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | Exact public API origin; production requires an explicit non-local HTTPS value |
| `EXPO_PUBLIC_APP_SCHEME` | Public app/deep-link scheme aligned with server `EXPO_SCHEME` |
| `EXPO_IOS_BUNDLE_IDENTIFIER` | Environment-specific iOS application identifier |
| `EXPO_ANDROID_PACKAGE` | Environment-specific Android application ID |
| `APP_VARIANT` | EAS profile marker; the included profiles set development, preview, or production |

Web checkout is not configured with a public direct URL. The authenticated web app posts an
allowlisted slug to the API and opens only the returned URL. Native code must not use that web route
to unlock digital features.

## Verify before editing

```sh
bun run check
bun run build
bun run db:check
bun run auth:schema:check
```

`check` validates lint/format policy, documentation, CLI tests, workspace typechecks, and workspace
tests. The build and two schema checks are separate commands, so run all four before release.

If `doctor` reports that Docker is installed but the engine is unreachable, start Docker Desktop and
run it again. The diagnostic does not start Docker for you.

## Stop local work

```sh
docker compose stop postgres
```

The named database volume remains. `docker compose down --volumes` deletes local database data; use
it only when data loss is explicitly intended.

## Official sources

- [Install Bun](https://bun.sh/docs/installation)
- [Bun lockfile and frozen installs](https://bun.sh/docs/pm/lockfile)
- [Docker Compose quickstart](https://docs.docker.com/compose/gettingstarted/)
- [Expo local development](https://docs.expo.dev/get-started/start-developing/)
- [Expo SDK compatibility matrix](https://docs.expo.dev/versions/latest/)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
