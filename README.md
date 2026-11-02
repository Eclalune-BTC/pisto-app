# Pisto

Pisto is a business operating application for Spanish-speaking small businesses: sales, catalog and
inventory, cash and expenses, customers and receivables, and exact operating reports. It is a
TypeScript monorepo with an Expo Router client (web, iOS, Android) and a Bun/Elysia API backed by
PostgreSQL 18 through Drizzle, Better Auth sessions and shared Zod request/response contracts.

The product interface is Spanish (`es-SV`); code, commits and documentation are English.

**Live demo:** <https://pisto.contact-862.workers.dev> (Cloudflare Workers + Neon PostgreSQL).

## Demo accounts and roles

`bun run db:seed` creates these accounts in the business *Abarrotes La Ceiba*, with products,
stock, cash accounts, expenses, sales and receivables. The hosted demo is already seeded. The
password for all three is `PistoDemo2026` unless `SEED_PASSWORD` was set when seeding.

| Role | Email | Can do |
| --- | --- | --- |
| Owner (dueño) | `dueno@pisto.test` | Everything, including business settings |
| Admin (encargado) | `encargado@pisto.test` | Every operation except changing business settings |
| Member (vendedor) | `vendedor@pisto.test` | Record and view sales; view catalog and stock. No cash, expenses, customers, receivables or reports |

Permissions are checked on the server for every request; the app only hides what the role cannot use.
The owner can add more users from Configuración → Negocio y usuarios (name, email, role and an initial
password; an email that already has an account keeps its own password), change their role or remove
them; a removed user is refused from their next request.

## What the MVP does

Every flow below works end to end, from the screen through the API to PostgreSQL. The
[Postman collection](#api-collection-postman-or-bruno) exercises each endpoint.

| User story | Screens | API |
| --- | --- | --- |
| Create an account, sign in and sign out | `/sign-up`, `/sign-in`, user menu | `/api/auth/sign-up/email`, `/api/auth/sign-in/email`, `/api/auth/sign-out` |
| Register my business with its currency and time zone | `/business`, `/settings` | `GET/POST /v1/businesses` |
| Record a sale, review it before saving, see history, void or correct it | `/operate/sales`, `/operate/sales/new`, `/operate/sales/[saleId]`, `/operate/sales/correct/[saleId]` | `/v1/sales`, `/v1/sales/review`, `/v1/sales/:id/void`, `/v1/sales/:id/replace` |
| Manage categories and products | `/operate/catalog`, `/operate/catalog/categories` | `/v1/catalog/categories`, `/v1/catalog/products` |
| Receive and adjust stock, reverse a movement | `/operate/inventory` | `/v1/inventory/stock`, `/v1/inventory/products/:id/movements`, `/v1/inventory/movements/:id/reverse` |
| Track cash accounts, adjustments and transfers | `/operate/cash` | `/v1/cash/accounts`, `/v1/cash/adjustments`, `/v1/cash/transfers`, `/v1/cash/movements` |
| Record and void paid expenses | `/operate/expenses` | `/v1/expenses` |
| Register customers, charge on credit, collect and reverse payments | `/operate/customers`, `/operate/receivables` | `/v1/customers`, `/v1/receivables`, `/v1/receivable-payments/:id/reverse` |
| See the operating report for a period | `/operate/reports` | `GET /v1/reports/operating` |
| See changes from other devices live | Every screen (sidebar shows **En vivo**) | `GET /v1/realtime` (WebSocket) |

Billing adapters (Polar, RevenueCat) exist but are disabled by default. AI and voice entry are
planned, not implemented. [The capability matrix](docs/production-capabilities.md) owns the
detailed status.

## Run it locally

### Requirements

- [Git](https://git-scm.com/)
- [Bun](https://bun.sh/) 1.4.0 or newer
- [Node.js](https://nodejs.org/) 24.19 or newer within major 24
- [Docker Desktop](https://www.docker.com/products/docker-desktop/), running (on Windows, with its
  default WSL 2 engine)
- A recent browser

No cloud account or payment credential is needed.

### Steps

From a terminal (on Windows, PowerShell or Git Bash):

```sh
git clone https://github.com/Eclalune-BTC/pisto-app.git
cd pisto-app
bun install --frozen-lockfile
bun run setup
docker compose up -d --wait postgres
bun run db:migrate
bun run db:seed
```

`bun run setup` creates `.env` and `apps/app/.env.local` with a random local auth secret. It never
overwrites existing files. `--wait` returns once PostgreSQL reports healthy, so the migration does
not race the first database start. `db:migrate` creates every table from the SQL migrations in
`packages/db/migrations`; `db:seed` loads the demo accounts above and is safe to run again. `bun run doctor` checks both files if something looks misconfigured.

Then start the two processes in separate terminals:

```sh
# Terminal 1: API on http://localhost:3001
bun run dev:api
```

```sh
# Terminal 2: web app on http://localhost:8081
bun run --cwd apps/app web
```

Open <http://localhost:8081> and sign in with a demo account, or choose **Crear cuenta** and
register your own business. The sidebar then
lists every module (**Movimientos**, **Ventas**, **Gastos**, **Caja y bancos**, **Por cobrar**,
**Por pagar**, **Productos**, **Proveedores**, ...). The **Dictar** button and the **Registrar** card
on the home need the AI assistant: run the API as the Worker (`npx wrangler dev` in `apps/api`, see
[the deployment runbook](docs/deployment-cloudflare.md#local-worker)) or set `CLOUDFLARE_ACCOUNT_ID`
and `CLOUDFLARE_AI_API_TOKEN` in `.env`; without them the assistant reports itself as off.
<http://localhost:3001/ready> returns `"status":"ready"` when the API reaches the database.

To see realtime updates, open the app in two browsers (or a normal and a private window), sign in
to the same business and record a sale in one: the other refreshes its figures without a reload.

To confirm the whole stack from the command line, run `bun run smoke:local` while both processes
are up. It signs up a throwaway account, creates a business and a sale, checks the report, voids
the sale and signs out.

### Troubleshooting

| Problem | Fix |
| --- | --- |
| `docker compose up` says port 5432 is not available, or migrations fail with a password error | Another PostgreSQL (often a native Windows install) owns port 5432. In `.env`, set `POSTGRES_PORT=55432` and change the port in `DATABASE_URL` to `55432`, then run `docker compose up -d --wait postgres` and `bun run db:migrate` again. |
| PowerShell refuses to run `bun.ps1` or `npx.ps1` | Use `bun.cmd` and `npx.cmd` instead, or run the commands from Git Bash. |
| `Cannot connect to the Docker daemon` | Start Docker Desktop and wait until it reports that the engine is running. |
| The browser shows a network or origin error | Open the app exactly at `http://localhost:8081`. The API only accepts the origins listed in `CORS_ORIGINS` and `TRUSTED_ORIGINS` in `.env`; if Expo had to pick another port, add that origin to both. |
| Sign-up or sign-in answers `429` | Better Auth allows three sign-up or sign-in attempts per 10 seconds on a local machine. Wait 10 seconds and retry. |
| Expo asks to install updates | Not required. The lockfile pins the tested versions. |

### Environment variables

`bun run setup` copies `.env.example` to `.env` (server) and `apps/app/.env.example` to
`apps/app/.env.local` (client). The defaults run locally without changes.

| Group | Variables |
| --- | --- |
| API | `API_HOST`, `API_PORT`, `API_REQUEST_BODY_LIMIT_BYTES`, `PRODUCT_WRITES_ENABLED`, `PRODUCT_READ_LIMIT_PER_MINUTE`, `PRODUCT_WRITE_LIMIT_PER_MINUTE` |
| Database | `DATABASE_URL`, `DATABASE_SSL`, `DATABASE_MAX_CONNECTIONS`, timeouts, and `POSTGRES_*` for the local container |
| Authentication | `BETTER_AUTH_SECRET` (generated by setup), `BETTER_AUTH_URL`, `CORS_ORIGINS`, `TRUSTED_ORIGINS`, `EXPO_SCHEME`, `AUTH_EMAIL_PASSWORD_ENABLED`, `AUTH_TRUSTED_PROXY_HEADERS`, `AUTH_IP_ADDRESS_HEADER` |
| Billing (disabled) | `BILLING_ENABLED`, `POLAR_*`, `REVENUECAT_*` |
| Client | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_SCHEME`, `EXPO_IOS_BUNDLE_IDENTIFIER`, `EXPO_ANDROID_PACKAGE` |
| Seed (optional) | `SEED_PASSWORD` |

## Deployment

The hosted demo runs on Cloudflare Workers: one Worker serves the web export and a Durable Object
runs the same API against Neon PostgreSQL with a least-privilege role. The procedure is in
[the deployment runbook](docs/deployment-cloudflare.md) and the decision in
[ADR 0020](docs/adrs/0020-cloudflare-workers-neon-hosting.md).

## Branching

- `main`: delivered versions only.
- `develop`: integration branch; every change arrives through a merge commit.
- `feature/<name>` for product work and `docs/<name>` for documentation, branched from `develop`
  and merged back with `git merge --no-ff`.

Commits follow Conventional Commits (`type(scope): subject`) in English.

## API collection (Postman or Bruno)

[`docs/postman`](docs/postman) contains a Postman v2.1 collection and a local environment. It calls
every Pisto route plus every Better Auth endpoint the app uses:

- `pisto.postman_collection.json`: 106 requests in 11 folders, from health checks and sign-up
  through catalog, inventory, cash, expenses, sales, receivables, reports and billing. It also
  includes negative checks for validation, authentication, foreign origins, unknown records,
  idempotency conflicts and session revocation.
- `pisto-local.postman_environment.json`: `baseUrl` (`http://localhost:3001`) and `webOrigin`
  (`http://localhost:8081`).
- `pisto-production.postman_environment.json`: the same two values for the hosted demo.

To use it:

1. **Postman:** choose *Import*, select both files, choose the **Pisto local** environment, then
   *Run collection* in its listed order with a **1000 ms delay** between requests. **Bruno:** choose *Import Collection*, then *Postman
   Collection*.
2. Each run signs up a new demo account and business, stores the ids it creates and checks every
   response. The session is the HttpOnly `pisto.session_token` cookie, which the client keeps
   automatically.
3. From a terminal, with the API running:

   ```sh
   npx newman run docs/postman/pisto.postman_collection.json -e docs/postman/pisto-local.postman_environment.json --delay-request 1000
   ```

Run one collection at a time and leave 10 seconds between runs, because of the sign-up/sign-in
limit above. One run makes more business writes than the 60 per minute each user may make, so
the delay keeps it under that limit. Locally the AI assistant requests accept 503 unless Workers AI
credentials are configured; against the hosted Worker they return the draft.
If the API runs on another port, change `baseUrl`. `webOrigin` must be one of the origins in
`CORS_ORIGINS` and `TRUSTED_ORIGINS`. [The API guide](docs/api-elysia.md#public-surface) lists
each route with its permission.

## Security

- Passwords are hashed by Better Auth (scrypt) and are never stored or returned in plain text.
  Sessions use an HttpOnly cookie, and sign-out revokes the session on the server.
- Every business-data route under `/v1` requires a fresh session, an active business and a role
  permission (owner, admin or member, see above) checked on the server. A client can never choose
  its tenant. The realtime socket admits only members of the active business from an allowed origin.
- Strict Zod contracts validate every request body, list query and record identifier. Unknown keys, malformed amounts,
  impossible dates and wrong types return `400 VALIDATION_ERROR` with field details. Unknown or
  malformed record ids return `404`.
- Money is stored as exact integer minor units. Financial commands use idempotency keys, run in
  database transactions, leave an operation receipt and are corrected by void or reversal entries
  instead of being deleted.
- The API also enforces rate limits, rejects writes from foreign browser origins, accepts only
  JSON bodies within a size limit, and sends security headers on every response and
  `Cache-Control: no-store` on `/v1`. Pisto errors share one `{ "error": { code, message,
  requestId } }` envelope instead of crashing the process; Better Auth answers with its own
  `{ code, message }`.

[The security baseline](docs/security.md) has the full threat model and controls.

## Architecture

| Path | Responsibility |
| --- | --- |
| `apps/app` | Expo Router universal client and platform adapters |
| `apps/api` | Bun/Elysia HTTP composition, middleware, realtime hub, the Docker image and the Cloudflare Worker entry |
| `packages/contracts` | Shared request, response and error schemas |
| `packages/db` | PostgreSQL schema, migrations and repositories |
| `packages/auth` | Better Auth server configuration |
| `packages/billing` | Provider adapters and provider-neutral entitlements |
| `packages/config` | Shared server environment parsing |
| `scripts` | Safe setup, diagnostics and smoke-test CLI |
| `docs` | Architecture, data model, API, security, decisions (ADRs) and the API collection |

Start with [the documentation map](docs/README.md). [Architecture](docs/architecture.md),
[the data model](docs/data-model.md) and [the API guide](docs/api-elysia.md) describe the
implemented design, and [the ADRs](docs/adrs/README.md) record why it changed.

## Validation

- `bun run check` runs formatting and lint rules, documentation checks, type checks, every unit
  test and the web export.
- `bun run verify` adds environment diagnostics and the PostgreSQL integration suites. Point
  `DATABASE_URL` at a disposable database first.
- `bun run smoke:local` exercises the running API end to end.

## Billing boundary

Polar is the browser checkout and customer portal. Native apps must use Apple StoreKit or Google
Play Billing for in-app digital goods where store rules apply. Both paths write into the same
internal entitlement model, so product code never trusts a provider response directly. Billing is
disabled until a provider sandbox is configured.

## License

No project license has been selected. Add one before distributing the project outside the team.
