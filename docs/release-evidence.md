# Local delivery evidence

## September 26: durable new-sale reviews

The owner authorized publishing the existing local work and starting the remaining product work.
GitHub `main` and the audit branch were fast-forwarded to `18922d7`, with the 25 previously
unpublished commits attributed to `wkatir <wilmerhenrysalazarmartinez@gmail.com>`. Source trees were
unchanged by that identity correction; no published history was rewritten. GitHub CI run
`36275414318` passed for that synchronized baseline. Source publication is not a hosted deployment.

The new-sales increment implements [ADR 0018](adrs/0018-durable-sale-review.md). Opening a review
only reads. Explicit confirmation reuses the original key and the existing posting transaction;
the sale, receipt, and recoverable result commit atomically. Closing a saved review requires
acknowledging its exact sale ID. A cancel racing with a successful confirmation cannot hide the
saved result, even when the cancel response is lost.

Validation on Bun 1.4.0:

- `bun run check`, with Turbo task-cache bypassed: exit 0; 524 tests passed (39 scripts, 70
  contracts, 47 database unit, 10 auth, 21 billing, 69 API, and 268 app tests), all workspace
  typechecks and builds passed, and the Expo web export completed.
- PostgreSQL integration: 70 passed, 434 assertions across nine files, against a newly created
  isolated local database. This includes 11 recovery cases and the complete pre-existing suites.
- `bun run db:check`: exit 0. `bun run audit:ci`: exit 0, 752 packages checked with the same four
  documented exceptions. No dependency was added or upgraded; the exceptions were not resolved.
- An isolated headless Chrome session exercised the built web application with synthetic account
  and business records. A prepared review survived reload with its exact key and amount. The
  browser then dropped the POST confirmation response after HTTP 201: the screen recovered the
  saved sale, survived another reload, and history contained exactly one additional $12.50 sale.
  Explicit acknowledgement cleared the review and returned an empty new-sale form.
- The review was inspected at wide and 390 CSS-pixel widths. At the compact width, body and
  document scroll widths matched the viewport; this is responsive-web evidence, not native-device
  or full accessibility acceptance. The lost-response run used the wide viewport.
- Migration `0006` was first exercised on the isolated database, then applied to the configured
  local `pisto` database at `localhost:55438` after an exclusive private PostgreSQL custom-format
  backup. The migration count increased from six to seven and the new review table was empty.
  Existing business tables were not transformed and synthetic transactions did not use that database.

The attempted read-only reviewer could not start; this increment has self-review and the automated
and browser evidence above, not an independent-agent review. No cloud, provider, signed native
binary, physical device, or store release was validated in this increment.

## September 10 baseline record

Date: 2026-09-10. Baseline: `92fd080`; integrated local branch: `codex/audit-completion`.
The owner's latest instruction is local-only. This record distinguishes local acceptance from
historical cloud activity and remaining product work.

The subsequent [component design review](component-design-review.md) records the owner's restrained
UI request, semantic theme/component changes and their own validation. This preserves the original
data/runtime audit evidence below without implying every earlier screenshot shows the new design.

## Current runtime

| Component | Verified local target |
| --- | --- |
| Expo web | `http://localhost:8090` |
| Bun/Hono API | `http://localhost:3015` |
| PostgreSQL 18 | `localhost:55438`, database `pisto`, Compose project `pisto-audit` |
| Toolchain | Bun 1.4.0, Node 24.19.0 |

The root private `.env` and app `.env.local` point to these local services. Billing is disabled.
No current runtime requires Neon, Vercel, Firebase or another cloud service. Existing local services
using other ports/databases were preserved.

For this already configured workspace, start the API and web in separate PowerShell terminals:

```powershell
# Use the repository-pinned Bun when the system Bun is older.
$env:PATH = (Resolve-Path .cache/tooling/bun-1.4.0/bun-windows-x64).Path + ';' + $env:PATH
bun --env-file=.env apps/api/src/index.ts
```

```powershell
$env:PATH = (Resolve-Path .cache/tooling/bun-1.4.0/bun-windows-x64).Path + ';' + $env:PATH
bun run --cwd apps/app web --port 8090
```

The private tooling cache is specific to this machine; other checkouts should install the pinned
Bun version normally. See [local setup](web-deployment.md#current-local-workflow) for a fresh checkout.
Do not start duplicate processes while these ports are already serving the app.

## Validation

- Integrated `bun run check`: exit 0. Lint, documentation links, script tests, package typechecks,
  package tests and Expo web export passed. This includes 229 app tests, 65 API tests and 36 script
  tests; additional contract/database/auth/billing tests also passed.
- PostgreSQL integration: 54 passed, 371 assertions, eight files, against the local database;
  this now includes eight real billing webhook cases in the root integration command.
- Local-configured Expo export for web, Android and iOS: exit 0, artifacts in the ignored
  `.cache/code-audit-platform-export` directory. The web entry links the generated 32 KB stylesheet;
  Android/iOS Hermes bundles are 8.2/8 MB. These are bundles, not signed binaries or device tests.
- `bun run audit:ci`: passed, 752 packages checked with four documented existing exceptions.
  This is not a claim of zero known advisories; see the [security exception record](security.md#dependency-audit-snapshot).
- `bun run db:check` and `bun run auth:schema:check`: exit 0; Better Auth 1.7.1 schema matches.
- Portable Docker image `pisto-api:audit-20260910` built; its migration entrypoint ran against local
  PostgreSQL, `/health` and `/ready` returned 200, unauthenticated `/v1/me` returned 401, runtime user
  is `bun`, and graceful shutdown exited 0. Later source changes affect UI, tooling and documentation.
- A standard PostgreSQL 18.6 dump from a read-only Neon connection restored into an isolated local
  database: 29 public tables plus migration table, six migrations, 474 validated constraints and no
  invalid indexes. Counts match. This proves an exit path, not a measured recovery SLA.

The repeatable local smoke uses synthetic QA records and refuses non-loopback destinations,
redirects and configured HTTP proxies before creating an account:

```powershell
$env:SMOKE_API_URL = 'http://localhost:3015'
$env:SMOKE_WEB_ORIGIN = 'http://localhost:8090'
bun run smoke:local
```

Its 23 real HTTP checks passed: health/readiness, sign-up/session, business creation, strict catalog
query handling, sale confirmation, same-key replay, changed-payload conflict, history/report totals,
auditable void, corrected totals, sign-out and rejected revoked cookie. Authenticated API responses
were checked for `no-store`. It retains a named QA business and voided sale; it revokes its session
and never logs its password or cookie. Twenty-two focused tests cover the smoke's destination,
proxy and cookie boundaries. It is a local test tool, not a production acceptance command.

## Browser evidence

Real Chrome interactions on the local runtime verified sign-up, explicit business confirmation,
sale review/save, persisted detail and history at 390 CSS px. Web checked-state mapping was repaired
and verified with an actual checkbox interaction. At 1440 CSS px, a sidebar that incorrectly consumed
856 px now occupies 272 px; the corrected layout was inspected in the browser.
At 768 CSS px the loaded report retained its dates, controls and confirmed $9.50 total, with both
body/document scroll width equal to the viewport width. The temporary viewport override was reset
and the QA browser session was signed out before handoff.

A controlled 25-second row lock on the synthetic QA session delayed a real sale request. During the
request, Confirm, Edit and Back were disabled. Releasing the lock changed no session data and allowed
one $9.50 sale to finish successfully. This validates the mounted confirmation, not protection against
all shell/browser/native navigation. No real customer or business transaction was used.

Existing committed screenshots establish the previous design baseline. They are not presented as
new screenshots of this revision. Browser checks do not establish full accessibility conformance,
physical-device behavior or measured performance targets.

## Withdrawn cloud activity

The earlier Vercel publication was outside the corrected scope. Project `pisto-app-eclalune` was
removed, including its deployments; its former public root returned 404 after removal. The Vercel
adapter and publishing configuration were removed from source. Local link metadata and obsolete
provider environment settings were moved to ignored private/cache locations and are not loaded.
There is no accepted hosted release and no further publication or push after the local-only instruction.

The previously requested Neon project `wispy-violet-09001133` remains unused with private credentials
retained outside source control. It is not the active database. Railway provisioning was rejected by
the expired trial; no paid plan was selected. Future hosting or remote resource changes require a
separate owner instruction. Standard PostgreSQL, Docker and Expo artifacts preserve provider choice.

## Remaining acceptance limits

The manual core is locally usable; the whole future product is not declared complete. New-sale
reviews have the bounded server-owned recovery described above. Correction, cash, expense,
inventory, and receivable commands still need durable recovery across route unmount/reload.
Full screen-reader/device acceptance, email delivery/recovery,
team invitations, catalog-linked sales, AI/voice, billing purchases and signed native/store releases
remain separate work. Availability/performance/recovery targets have not been measured.

See [product requirements](product-requirements.md), [UX requirements](ux-requirements.md),
[data model](data-model.md) and [audit](audit-2026-09-10.md) for implemented behavior and priorities.
