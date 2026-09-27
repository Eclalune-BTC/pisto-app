# Local delivery evidence

## Scope and evidence ownership

This is a bounded record of completed checks, not a live-service status page or a next-task prompt.
Git records earlier delivery history. The capability matrix owns current feature status; runtime
instructions live in [getting started](getting-started.md). GitHub source publication is authorized;
no hosted or store release is established by the checks below.

## Current runtime

The configured desktop workspace uses Expo web on `localhost:8090`, Bun/Hono on `localhost:3015`
and PostgreSQL 18 on `localhost:55438`, database `pisto`, Compose project `pisto-audit`. Server and
client configuration stay in ignored environment files. Billing is disabled. These are configured
targets, not a statement that every process is currently running.

## Validation

Recorded on 2026-09-26 for the implemented manual core and new-sale recovery:

- `bun run check`, with Bun 1.4.0 and Turbo task cache bypassed: 524 tests passed (39 scripts,
  70 contracts, 47 database unit, 10 auth, 21 billing, 69 API and 268 app), with workspace types,
  builds and web export. The subsequent documentation-only styling/startup revision repeated it.
- PostgreSQL integration: 70 passed, 434 assertions across nine files, using an isolated local
  database. Eleven recovery cases supplement the existing domain and billing suites.
- `db:check` and `auth:schema:check` passed. `audit:ci` checked 752 packages with four unresolved
  exceptions; see [security](security.md#dependency-audit-snapshot), not a zero-advisory claim.
- The all-platform Expo export produced web assets and Android/iOS Hermes bundles. A first attempt
  exited nonzero; a second completed with exit 0 without source/dependency changes. Its initial
  cause was not isolated. Neither attempt was an installed native application or device test.
- The online Expo install check recommended ten newer patches, which were not installed. The
  [dated dependency review](frontend-expo-ui.md#dependency-review-on-2026-09-26) lists them.

GitHub CI separately validates source/tests, migrations/integrations, the configured advisory
exceptions, schema contracts, credential-free infrastructure tests and the portable API image.
Inspect the run for the actual commit before asserting its result; old green runs do not validate
new code. The image checks include probes, unauthenticated denial, bundled migrations and shutdown.

The local smoke command uses synthetic records, refuses non-loopback destinations/redirects/proxies,
revokes its session and retains its voided test sale. Its prior 23-request run passed; it is not
executed by documentation maintenance or a read-only diagnostic:

```powershell
$env:SMOKE_API_URL = 'http://localhost:3015'
$env:SMOKE_WEB_ORIGIN = 'http://localhost:8090'
bun run smoke:local
```

## Browser evidence

The 2026-09-26 recovery check used an isolated Chrome session and synthetic account/business data.
A prepared review survived reload with the same key and amount. Dropping the POST confirmation
response after HTTP 201 still allowed recovery after another reload; history contained exactly one
additional $12.50 sale. Acknowledging its exact ID cleared the review. Wide and 390 CSS-pixel review
layouts were inspected, with no compact horizontal page overflow.

Earlier browser checks covered authentication, business confirmation, history, report controls,
checked-state semantics, a 272 px desktop sidebar, and mounted pending-command controls. Existing
screenshots are baseline references, not proof of the current revision's full behavior. Browser
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
