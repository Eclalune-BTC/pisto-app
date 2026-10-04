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
- The dependency audit still reports the same five Expo/toolchain advisories; no exceptions were
  added. The [replacement Polar SDK migration](versioning-upgrades.md#polar-and-revenuecat) and real
  provider sandbox acceptance remain pending. No hosted deployment or new portable image is claimed.

GitHub CI separately validates source/tests, migrations/integrations, the configured advisory
exceptions, schema contracts, credential-free infrastructure tests and the portable API image.
Inspect the run for the actual commit before asserting its result; old green runs do not validate
new code. The image checks include probes, unauthenticated denial, bundled migrations and shutdown.

## Browser evidence

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
