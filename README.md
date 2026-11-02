# Pisto

Pisto is a business operating application for Spanish-speaking small businesses: sales, catalog and
inventory, cash and expenses, customers and receivables, and exact operating reports. It is a
TypeScript monorepo with an Expo Router client (web, iOS, Android) and a Bun/Elysia API backed by
PostgreSQL 18 through Drizzle, Better Auth sessions and shared Zod request/response contracts.

The product interface is Spanish (`es-SV`); code, commits and documentation are English.

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
```

`bun run setup` creates `.env` and `apps/app/.env.local` with a random local auth secret. It never
overwrites existing files. `--wait` returns once PostgreSQL reports healthy, so the migration does
not race the first database start. `bun run doctor` checks both files if something looks misconfigured.

Then start the two processes in separate terminals:

```sh
# Terminal 1: API on http://localhost:3001
bun run dev:api
```

```sh
# Terminal 2: web app on http://localhost:8081
bun run --cwd apps/app web
```

Open <http://localhost:8081>, choose **Crear cuenta** and register the business. The sidebar then
lists every module (**Ventas**, **Gastos**, **Caja y cuentas**, **Catálogo**, ...).
<http://localhost:3001/ready> returns `"status":"ready"` when the API reaches the database.

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

## API collection (Postman or Bruno)

[`docs/postman`](docs/postman) contains a Postman v2.1 collection and a local environment. It calls
every Pisto route plus every Better Auth endpoint the app uses:

- `pisto.postman_collection.json`: 106 requests in 11 folders, from health checks and sign-up
  through catalog, inventory, cash, expenses, sales, receivables, reports and billing. It also
  includes negative checks for validation, authentication, foreign origins, unknown records,
  idempotency conflicts and session revocation.
- `pisto-local.postman_environment.json`: `baseUrl` (`http://localhost:3001`) and `webOrigin`
  (`http://localhost:8081`).

To use it:

1. **Postman:** choose *Import*, select both files, choose the **Pisto local** environment, then
   *Run collection* in its listed order. **Bruno:** choose *Import Collection*, then *Postman
   Collection*.
2. Each run signs up a new demo account and business, stores the ids it creates and checks every
   response. The session is the HttpOnly `pisto.session_token` cookie, which the client keeps
   automatically.
3. From a terminal, with the API running:

   ```sh
   npx newman run docs/postman/pisto.postman_collection.json -e docs/postman/pisto-local.postman_environment.json
   ```

Run one collection at a time and leave 10 seconds between runs, because of the sign-up/sign-in
limit above. One run uses about 50 of the 60 business writes per minute that each user may make.
If the API runs on another port, change `baseUrl`. `webOrigin` must be one of the origins in
`CORS_ORIGINS` and `TRUSTED_ORIGINS`. [The API guide](docs/api-elysia.md#public-surface) lists
each route with its permission.

## Security

- Passwords are hashed by Better Auth (scrypt) and are never stored or returned in plain text.
  Sessions use an HttpOnly cookie, and sign-out revokes the session on the server.
- Every business-data route under `/v1` requires a fresh session, an active business and a role
  permission checked on the server. A client can never choose its tenant.
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
| `apps/api` | Bun/Elysia HTTP composition, middleware, health checks and the Docker image |
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
