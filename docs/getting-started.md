# Getting started

Use [Existing Windows workspace](#existing-windows-workspace) for the configured desktop checkout.
Use [First checkout](#first-checkout) only for a new clone. They use different ports and Compose
project names. Technical notes and commit messages are written in English; the product's approved
Spanish interface remains in `apps/app/src/i18n/resources/es-SV.ts`.

## Prerequisites

- Bun **1.4.0 or newer**. The repository pins `bun@1.4.0` in `package.json`.
- Node.js **24.19.0 within major 24**; `package.json` requires `>=24.19.0 <25` and `.node-version`
  pins 24.19.0. Expo SDK 57's documented floor is 22.13.x, but the repository intentionally uses the
  narrower current-LTS baseline.
- Docker with the Compose plugin for local PostgreSQL 18.
- Git.
- For local native compilation/emulators: Android Studio and its toolchain for Android, or macOS
  and Xcode for iOS. A physical-phone Expo Go preview does not itself require those build tools.
- A recent browser for the web target.

The baseline does not require Polar, RevenueCat, Apple, Google Play, or Google Cloud credentials to
run with billing disabled.

## Existing Windows workspace

Checked on 2026-09-26 for `C:\Users\wilme\OneDrive\Escritorio\pisto`:

| Component | Configured value |
| --- | --- |
| Database | PostgreSQL 18, `localhost:55438`, database `pisto` |
| Compose project / container | `pisto-audit` / `pisto-audit-postgres-1` |
| API and Better Auth | `http://localhost:3015` |
| Expo web / allowed browser origin | `http://localhost:8090` |
| Server environment | Root `.env`, with billing disabled |
| Client environment | `apps/app/.env.local` |

The system `bun` was 1.3.14, which is older than this repository requires. This checkout already has
the pinned 1.4.0 executable in its ignored tooling cache. Select it in each PowerShell terminal;
this does not change the global toolchain or another project. On another machine, install the pinned
Bun normally rather than relying on this machine-specific cache path.

### Terminal 1: database and API

Start Docker Desktop first. Then, from the project root:

```powershell
Set-Location 'C:\Users\wilme\OneDrive\Escritorio\pisto'
$env:PATH = (Resolve-Path '.cache/tooling/bun-1.4.0/bun-windows-x64').Path + ';' + $env:PATH
bun --version
node --version
docker compose -p pisto-audit ps
```

Expected tool versions are Bun 1.4.0 and Node 24.19.0. If the existing PostgreSQL service is stopped,
start that same service, without creating a different Compose project or database volume:

```powershell
docker compose -p pisto-audit start postgres
```

If the container does not exist, stop and reconcile the configured database/volume before using the
fresh-checkout instructions. Other Pisto/Supabase containers on this machine are not this app's
configured database. Do not stop them or replace them to free a port.

Start the API and leave the terminal running:

```powershell
bun run dev:api
```

### Terminal 2: Expo web

```powershell
Set-Location 'C:\Users\wilme\OneDrive\Escritorio\pisto'
$env:PATH = (Resolve-Path '.cache/tooling/bun-1.4.0/bun-windows-x64').Path + ';' + $env:PATH
bun run --cwd apps/app web --port 8090
```

Open `http://localhost:8090`. API diagnostics are `http://localhost:3015/health` and
`http://localhost:3015/ready`. `/health` proves the process responds; `/ready` also checks the
configured database. Check whether the intended ports already have a running Pisto instance before
starting another one. Do not silently accept a different Expo port without aligning browser origins.

Setup and migrations are not required on every launch. The prior recovery delivery applied migration
`0006` to this local database. Apply later committed migrations only after checking the target and
taking an appropriate private backup. Starting the API does not apply database migrations.

## First checkout

This path uses the template defaults, not the configured Windows project above. Run commands from
the repository root:

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

Compose publishes PostgreSQL on `127.0.0.1` only. Physical devices connect to the API's LAN
address; they do not need direct database access. `POSTGRES_PORT` changes the local port while
preserving the loopback binding.

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

Or use two terminals from the root, one command in each:

```sh
# Terminal 1
bun run dev:api
# Terminal 2
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

## Phone and emulator networking

There are two connections: the device downloads JavaScript from Metro and separately calls the
Hono API. A working QR code does not prove the API is reachable. Docker/PostgreSQL stays on the
computer; never expose its port or put its credentials in the app.

| Client | API address for the configured Windows workspace |
| --- | --- |
| Browser on the same PC | `http://localhost:3015` |
| Standard Android Studio emulator on that PC | `http://10.0.2.2:3015` |
| Physical phone on the same trusted LAN | `http://<PC-LAN-IP>:3015`, with the actual IP substituted |

Before using a phone, set `EXPO_PUBLIC_API_URL` in the private app environment to its reachable API
origin. Keep the server's `BETTER_AUTH_URL` aligned with the chosen reachable auth origin, retain
`EXPO_SCHEME=pisto`, and keep exact browser `CORS_ORIGINS`/`TRUSTED_ORIGINS` for any browser used in
that session. The actual API config currently binds `0.0.0.0:3015`; restrict firewall permission to
the intended private network and development process. Do not disable the firewall or expose the
service publicly. HTTP LAN testing is for trusted development only; release requires HTTPS.

Check `/health` and `/ready` from the phone's browser before debugging application requests.
Restart the API after server environment changes and restart/reload Metro after client environment
changes. The configured `localhost` client URL cannot reach the PC from a physical phone. An Expo
tunnel changes how Metro is reached; it does not automatically tunnel the separately running API.
Return to the documented desktop URLs when ending a temporary LAN session.

## Expo Go preview

The free Uniwind/Tailwind 4 stack is compatible with Expo Go. Expo Go must support the project's
Expo SDK and included native-module versions; it is not a generic runtime for every Expo version.
See [the full compatibility explanation](frontend-expo-ui.md#expo-go-versus-a-development-build)
and the dated Expo patch recommendations before declaring a device accepted.

After the API is running and phone networking is configured, start Metro from `apps/app`:

```powershell
Set-Location 'C:\Users\wilme\OneDrive\Escritorio\pisto\apps\app'
node ../../node_modules/expo/bin/cli start --go --lan --port 8090
```

Use this instead of a second Metro process on the same port. Open its QR code with a compatible
Expo Go app. The server process must have `NODE_ENV=development` for the installed Better Auth Expo
plugin's development `exp://` allowance. No custom wildcard or disabled origin check is needed for
that existing behavior. This is a preview procedure, not evidence that sign-in, SecureStore session
restoration or all screens have passed on a physical device.

Expo Go does not install Pisto's own `pisto://` scheme, splash configuration or full native app
identity. Validate those in a custom build. Native store purchases remain unimplemented and cannot be
accepted through a preview alone.

## Local native development build

A custom development build is useful for ongoing Android/iOS work and app-specific native behavior.
The repository has an EAS development profile but has not installed `expo-dev-client`; that profile
alone is not a built or installed app. The following is a one-time setup procedure, not work already
executed by this documentation update.

Resolve the coordinated Expo patch recommendations, review the manifest/lockfile changes, and set
up the platform toolchain first. In `apps/app`, with the pinned Bun on PATH:

```sh
node ../../node_modules/expo/bin/cli install expo-dev-client --bun
node ../../node_modules/expo/bin/cli run:android
```

The install command changes dependencies and must be reviewed and committed. `run:android` generates
native files when needed, compiles, installs and starts the app; use `--device` for an attached
Android phone. Windows can build Android with its local Android toolchain. Local iOS compilation
and the iOS simulator require macOS/Xcode; there, use `run:ios` instead. No cloud build, account
provisioning or store submission is part of this local procedure.

For later JavaScript, TypeScript and ordinary style changes, start Metro without rebuilding the
native binary:

```sh
node ../../node_modules/expo/bin/cli start --dev-client --port 8090
```

Changes to native dependencies, the Expo SDK, schemes, permissions or relevant app configuration
require a reviewed regeneration/rebuild. Do not run a destructive `prebuild --clean` over native
customizations without checking what will be replaced. `bun run android` and `bun run ios` currently
mean `expo start --android/--ios`; neither command builds a native binary. The API still runs
separately in every native workflow.

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
| `REVENUECAT_ALLOWED_ENVIRONMENT` | `PRODUCTION` or `SANDBOX`; defaults to `PRODUCTION`. Only events from this store environment are projected into entitlements, so a sandbox purchase cannot grant production access |
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
bun run db:check
bun run auth:schema:check
```

`check` validates lint/format policy, documentation, CLI tests, workspace typechecks, and workspace
tests, then runs the workspace builds including the Expo web export. Running `bun run build` again
is optional when only that stage needs repeating. The two schema checks are separate gates.
`bun run test:integration` uses real database fixtures; verify an isolated target before running it.
`bun run verify` combines doctor, check and those integrations, so it is not a read-only diagnostic.

From `apps/app`, check Expo recommendations and test bundling for all targets separately:

```sh
node ../../node_modules/expo/bin/cli install --check
node ../../node_modules/expo/bin/cli export --platform all --output-dir ../../.cache/platform-export --max-workers 2
```

On 2026-09-26, the online install check recommended ten newer patches. Do not hide that warning or
mistake an all-platform export for a native build or Expo Go device test. The exact snapshot is in
[the frontend guide](frontend-expo-ui.md#dependency-review-on-2026-09-26).

If `doctor` reports that Docker is installed but the engine is unreachable, start Docker Desktop and
run it again. The diagnostic does not start Docker for you.

## Stop local work

Use Ctrl+C in the API and Expo terminals. To stop only the configured desktop database:

```sh
docker compose -p pisto-audit stop postgres
```

For a fresh checkout using the default project instead:

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
- [Expo CLI start, export and native run commands](https://docs.expo.dev/more/expo-cli/)
- [Expo Go and development build FAQ](https://docs.expo.dev/develop/development-builds/faq/)
- [Create a local development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator networking](https://developer.android.com/studio/run/emulator-networking)
- [Expo SDK compatibility matrix](https://docs.expo.dev/versions/latest/)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
