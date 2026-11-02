# Local delivery evidence

## Scope and evidence ownership

This is a bounded record of completed checks, not a live-service status page or a next-task prompt.
Git records earlier delivery history. The capability matrix owns current feature status; runtime
instructions live in [getting started](getting-started.md). GitHub source publication is authorized;
no hosted or store release is established by the checks below.

## Current runtime

The configured desktop workspace uses Expo web on `localhost:8090`, Bun/Elysia on `localhost:3015`
and PostgreSQL 18 on `localhost:55438`, database `pisto`, Compose project `pisto-audit`. Server and
client configuration stay in ignored environment files. Billing is disabled. These are configured
targets, not a statement that every process is currently running.

## Validation

The 2026-10-03 baseline at commit `3dc650c` uses Elysia 1.4.30, CORS 1.4.2 and the required
TypeBox 0.34.52 runtime peer under
[ADR 0019](adrs/0019-elysia-http-composition.md). Hono was removed from the manifest and lockfile.
Shared Zod contracts, repository authorization, the Expo REST client and database schema remain intact.

- `bun run check` passed: 757 tests across the CLI and workspaces, including 79 API tests, types,
  documentation and builds. Unchanged Turbo tasks reused validated local cache entries.
- `bun run doctor`, `db:check` and `auth:schema:check` passed. PostgreSQL 18 integration passed
  59 database and 14 billing tests in a disposable database, separate from the owner's local data.
- The final portable Docker image built with Bun 1.4.0, replayed bundled migrations, served
  health/readiness, denied anonymous requests, handled HEAD/OPTIONS and exited zero on SIGTERM.
  Its local image ID was `sha256:156468ef6e318a06b0459d5757bc82c1ecc7a935c39fe7d2fcbf3bcec580d4bc`.
- The isolated container's 23-request smoke passed real Better Auth sign-up/session/sign-out,
  business creation, idempotent sale creation, history, reporting and voiding. Test containers,
  their database volume and network were removed afterward; the owner's runtime was preserved.
- Independent read-only review and real-listener probes verified raw provider bytes, multiple
  cookies, security headers, early authentication, stream limits, identifier/JSON error precedence,
  scalar/duplicate query semantics, request actor isolation and safe preflight logging.
- A fresh Bun bundle graph contained 1,990 source inputs, including 25 Elysia inputs and zero Hono
  inputs. The lockfile, installed package graph and portable image contained no Hono dependency.
  Better Auth's telemetry includes the framework name in a detector list; that is not a router or import.
- `audit:ci` still fails on five existing Expo/toolchain advisories, documented in
  [Security](security.md#dependency-audit-snapshot). No new exception was added. This is local
  implementation/build evidence, not hosted deployment, native acceptance or production release.

The 2026-10-03 backend cleanup after `18f78d0` reduced production source by 60 net lines without
changing dependency manifests, public contracts or migrations. It consolidated creation/replay
responses, removed unused database code and casts, and corrected inherited-key error/entitlement
lookups. Polar auth lifecycle synchronization is disabled; checkout/portal retain the authenticated
user ID and SDK requests abort after 10 seconds without automatic retries.

- `bun run check` passed with 762 tests, including 81 API and 27 billing tests, plus typechecks,
  documentation and workspace builds. Unchanged tasks reused validated Turbo cache entries.
- All seven migrations applied to a disposable PostgreSQL 18 database. Its integration suites passed
  60 database and 15 billing tests; the container and temporary database were removed afterward.
- `doctor`, `db:check`, `auth:schema:check` and independent read-only review passed. The configured
  local API health/readiness and Expo HTML returned 200. No owner business records were written.
- The dependency audit still reported the same five Expo/toolchain advisories; no exceptions were
  added. This cleanup did not produce a new portable image or hosted deployment.

The subsequent Polar migration after `be53618` pins adapter 2.0.1 / SDK 1.0.2 and API `2026-10`.
Elysia remains 1.4.30, with exact JSON media-type enforcement. On 2026-10-03:

- `bun run check` passed with 773 tests, including 83 API and 36 billing tests, workspace types and
  builds. Unchanged tasks reused validated Turbo cache entries. `doctor`, `db:check` and
  `auth:schema:check` passed.
- PostgreSQL 18 integration passed 60 database and 15 billing tests after all seven migrations on a
  separate disposable database. Two Astra agents independently reviewed source, tests and dependencies;
  documentation also received independent review. Their only finding was a corrected test-label issue.
- Signed adapter fixtures covered both secret encodings, raw-body tampering, stale/future delivery
  timestamps, malformed data and corrected retry, and non-projecting unknown events. Intercepted
  outbound calls verified immutable identity, organization metadata, the real 10-second abort and no
  retry on HTTP 429/500. These are local fixtures, not provider sandbox purchases.
- The rebuilt portable image replayed bundled migrations and passed 18 real-HTTP/PostgreSQL
  assertions, including a signed grant, exact replay, invalid signature, failed required data,
  revocation and a late event that could not restore access. SIGTERM exited zero. Its local image ID
  was `sha256:faa44e9b5d99d52180b6e04244726a8e51566cee73d5739d300a07002244ce4d`.
- Task containers, their temporary database and network were removed. The owner's local API remained
  healthy and billing disabled. The audit still reports five existing Expo/toolchain advisories;
  real checkout/portal/purchase sandbox acceptance and hosted deployment remain unclaimed.

The 2026-10-03 frontend redesign after `5e639a8` keeps Expo/RNR and IBM Plex Sans, introduces shared
forest/sage themes, groups direct navigation links, exposes cash/expense sections together, and
removes the unused workspace-tab wrapper. Shared read-state composition and sales overview now live
at their owning component/feature boundaries. No financial API, schema, permission or query contract changed.

- `bun run check` passed: 773 tests including 474 frontend tests, types, documentation and web export.
  Unchanged workspace tasks reused validated Turbo entries. The dependency audit still reports the
  five existing Expo/toolchain advisories; no advisory exception was added.
- Uniwind 1.12.1 and Expo resolve Metro 0.84.5 to the same physical Graph module. Frozen installation
  succeeded after removing two obsolete, untracked nested Metro copies. Manifests and lockfile own the
  exact compatible development peers.
- Two independent Astra reviewers inspected the complete change and ran focused tests. Control-border
  contrast, short-height sidebar scrolling, native splash colors, shared mark radius and stale version
  documentation were corrected. Native bundle generation does not establish installed-device behavior.
- The final Android and iOS Hermes exports passed with the refreshed product captures (8.6 MB and
  8.4 MB respectively). Export logs contained the CLI's NO_COLOR/FORCE_COLOR warning, with no unsupported
  style warning. Temporary exports were removed after validation; the local development app remains available.

On 2026-11-01, after `2de11ef`, the README path ran on a new local clone of the working checkout
with the template ports (API 3001, Expo web 8081) and a separate Compose project:

- `bun install --frozen-lockfile` installed 834 packages, `setup` created both environment files,
  `doctor` reported no failures or warnings and all ten migrations applied to a new PostgreSQL 18
  container. That container used a non-default port because a native PostgreSQL owned 5432 on this
  machine; the README now documents that override.
- `smoke:local` passed. `/ready` and the Expo web HTML returned 200. In a browser, the clone's web
  app signed up a new account, created a USD business, confirmed a reviewed $12.50 sale and showed
  it in the operating report.
- Newman 6.2.3 ran the new [Postman collection](postman/pisto.postman_collection.json) with its
  unchanged local environment: 104 requests and 190 assertions passed. After an independent
  read-only review, the final 106-request version (preflight, organization denial, server-side
  revocation and stronger assertions) passed 206 assertions against the configured workspace
  (3015/8090). Each run creates its own account and business. Concurrent runs, or two runs within
  10 seconds, hit the shared local sign-up/sign-in limit; the README says so.
- The configured workspace database had migrations `0008` and `0009` pending. They were applied
  after a private `pg_dump` backup.
- `bun run check` had failed on three app TS2590 errors after Expo regenerated its typed routes.
  `2de11ef` narrows the record href helpers; the app typecheck and its 744 tests then passed.

This is local evidence. No hosted deployment or store release took place.

GitHub CI separately validates source/tests, migrations/integrations, the configured advisory
exceptions, schema contracts, credential-free infrastructure tests and the portable API image.
Inspect the run for the actual commit before asserting its result; old green runs do not validate
new code. The image checks include probes, unauthenticated denial, bundled migrations and shutdown.

## Browser evidence

The 2026-10-03 redesign was inspected in Chrome against the configured local app, without creating
business records. Checks sampled 320/390/768/1024/1440 CSS-pixel widths, light/dark themes, the task hub,
sales, cash, expenses, catalog, inventory, customers, receivables, reports and account navigation.
Actual successful empty reads stayed distinct from loading and form-validation errors. Unit tests
separately cover populated, stale, denied, offline and failed-query compositions; those mocks are not
claimed as browser fault-injection evidence.

- The 768x320 navigation menu could scroll to account/sign-out controls with keyboard focus. Escape
  dismissed the menu and restored its trigger; an open appearance tooltip consumes the first Escape.
- Expense category selection opened and restored focus on Escape. Public feature tabs changed with
  arrow keys, and the hero action moved focus to the product section. Compact filters wrapped long
  Spanish labels; intermediate catalog widths drove a final control-layout adjustment.
- Sales, customer and product forms were inspected without submitting data; an empty sale amount
  produced its real validation message. Public captures were refreshed in both themes from empty
  forms/report date controls, with account/business identity and financial results excluded.
- The public page was inspected at 1440 and 390 pixels. These checks establish bounded rendered
  behavior, not owner aesthetic approval, complete accessibility conformance or physical-device QA.

The 2026-09-27 RNR browser checks used isolated responses and wrote no records to the configured
database. They establish bounded behavior for that revision:

- Fifteen operating routes at 1440 and 390 CSS pixels in both themes had no horizontal document
  overflow or reported console errors. Expense selection, tab navigation, compact-menu routes,
  Escape dismissal, focus restoration and closing the menu after navigation were exercised.
- Fifty-two follow-up assertion groups covered Cash empty states at 320, 390, 768, 1024 and 1357
  CSS pixels; nine operating routes at wide/compact widths; and sign-in/sign-up in both themes.
  Checks measured at least 12 px filter side padding, 44 px control height, 24 px authentication
  inset, no horizontal page overflow and preserved focus.
- Business setup exposed the checkbox role, Space activation, label-based deselection and the
  corresponding create-button state. No creation was submitted by this fixture.
- The public page was inspected at 320, 390, 768, 1024 and 1440 CSS pixels in both themes.
  Product captures use actual RNR forms with isolated example configuration, no customer contacts,
  balances or transaction results. Captures are not live controls. Arrow-key tab selection,
  Tab focus into the selected panel and Enter activation of FAQ controls passed, with no duplicate IDs.

The same revision completed an all-platform Expo export with web assets and Android/iOS Hermes
bundles. This establishes neither a signed native binary nor installation or physical-device acceptance.

The 2026-09-26 recovery check used an isolated Chrome session and synthetic account/business data.
A prepared review survived reload with the same key and amount. Dropping the POST confirmation
response after HTTP 201 still allowed recovery after another reload; history contained exactly one
additional $12.50 sale. Acknowledging its exact ID cleared the review. Wide and 390 CSS-pixel review
layouts were inspected, with no compact horizontal page overflow.

Existing screenshots are baseline references, not proof of the current revision's full behavior. Browser
checks do not establish screen-reader conformance, physical-device behavior or performance targets.

## Database evidence

Migration `0006` was exercised on the isolated database before application to the configured local
`pisto` database after a private custom-format backup. Seven migrations were then applied; the new
review table was empty. Synthetic financial operations did not use the configured business database.
A prior standard PostgreSQL export/restore verified constraints and record counts on an isolated
pre-review schema. That proves a tested portability path for that snapshot, not current RPO/RTO.

## Remaining acceptance limits

New-sale reviews have [server-owned recovery](adrs/0018-durable-sale-review.md). Unreviewed inputs and
correction, cash, expense, inventory and receivable editors retain their separate recovery limits.
Physical Android/iOS, Expo Go sessions, complete accessibility, email delivery/recovery, invitations,
itemized sales, AI/voice, real provider purchases and signed store releases remain unaccepted or
unimplemented as specified in [the matrix](production-capabilities.md). Availability and performance
objectives have not been measured. No independent review is claimed for the recovery delivery.
