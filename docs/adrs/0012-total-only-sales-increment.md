# ADR 0012: Total-only sales as the first persisted product increment

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/app`, `@pisto/api`, `@pisto/contracts`, `@pisto/db`, `@pisto/auth`
- Supersedes: none
- Research recheck: correction delivery, multi-currency support, inventory integration, or AI-assisted entry

## Context

The approved product brief permits a total-only sale, but the complete first conversational milestone
also requires correction by void and replacement. The repository previously contained authenticated
shell and billing infrastructure without a persisted product operation. Implementing AI, voice,
catalog, inventory, payment methods, and correction together would make authorization, money,
time-zone, idempotency, and UX failures difficult to isolate.

The first useful increment must remain usable without a model provider and must not invent product or
inventory detail. It also needs a truthful monthly result before later interfaces can call the same
business commands and queries.

## Decision

- Increment 1 is a manual total-only sale, an explicit review/confirmation step, a canonical committed
  result, and a deterministic previous-calendar-month summary.
- This is an implementation increment, not completion of the approved conversational sales milestone.
  Void/replacement correction remains required before that milestone can be called complete.
- One Better Auth organization ID is the Pisto `businessId`. Business onboarding creates one
  organization, one exact `owner` membership, and create-once ISO currency plus IANA time-zone
  settings. Financial routes resolve the active organization from a fresh server session and reload
  exact owner access; the client never chooses a `businessId` in a financial command.
- Better Auth organization creation, deletion, invitation, member mutation, team, and role endpoints
  are blocked at the application edge. Only selection of the server-created active organization is
  exposed.
- Money crosses JSON as canonical decimal strings in minor units and persists as positive PostgreSQL
  `bigint`. On onboarding, the server derives and freezes the currency minor-unit exponent; clients
  use that server-owned value instead of deriving precision independently. JavaScript floating-point
  numbers never own authoritative money.
- A sale snapshots its occurrence instant, exact confirmed local date/minute, IANA time zone,
  currency, and currency exponent together with status, total-only entry mode, actor, and optional
  description. Nonexistent and ambiguous local minutes are rejected rather than guessed. The
  snapshot prevents later ICU/tzdb display changes from rewriting what the owner confirmed.
- Sale confirmation and its append-only operation receipt commit in one transaction. The receipt is
  unique by business, actor, and UUID idempotency key and binds a SHA-256 command fingerprint. An exact
  replay returns the original sale; a changed payload conflicts.
- The review step is client-visible product state, not an authorization boundary. A signed server
  preparation token is not added: confirmation reloads authorization and deterministically validates
  the complete command before the transaction.
- The previous-month query derives half-open business-local calendar bounds from one PostgreSQL query
  timestamp, converts them to UTC, filters posted sale occurrence time, and returns gross, count, and
  half-up average. A query failure is an error and never becomes a zero summary.
- Product code stays in the existing contract, database, API, and application owners. No new sales
  workspace, plugin system, event bus, RAG store, or service is introduced.

## Consequences

- Pisto now has a narrow real business operation shared by web, iOS, and Android code rather than an
  illustrative dashboard.
- Product- and inventory-level analysis, profit, payment method, multi-currency, offline writes,
  AI/voice entry, and correction are unavailable and must be described as such.
- Currency and time-zone changes are intentionally unavailable after sales begin in this increment.
- A command/key survives an uncertain response only while the review screen remains mounted. Safe
  crash/reload recovery needs a separately approved, subject-bound retention/reconciliation design;
  the app does not persist financial draft text in plaintext web storage as a shortcut.
- Owner-only authorization is narrower than a future roles system. Adding operators or accountants
  requires an explicit permission model and new denial/cross-tenant tests.
- Email verification and recoverable email delivery remain release blockers; local validation does
  not make the feature production-ready.

## Alternatives considered

- **Implement the full conversational milestone at once:** rejected because provider behavior would
  obscure the core financial invariants and delay a usable manual path.
- **Signed prepare/confirm token for manual entry:** rejected for this increment because it does not
  replace server authorization or validation and adds key/expiry state without changing the trusted
  boundary. Reconsider when untrusted model output proposes drafts.
- **Store major-unit decimal or JavaScript numbers:** rejected because money precision and range would
  depend on transport/runtime behavior.
- **Accept an offset-aware instant from the client:** rejected because the business time zone owns the
  wall-clock interpretation and DST ambiguity policy.
- **Add a sales package or microservice:** rejected because one cohesive slice has no independent
  deployment, scale, or ownership pressure.

## Validation

- Contract tests cover strict unknown-field rejection, signed-`int64` row money, and aggregates beyond
  one row's range.
- Pure domain tests cover currency precision, canonical and linked IANA identifiers, and unique,
  nonexistent, and ambiguous local minutes.
- PostgreSQL 18 integration tests apply the committed migration and cover business creation, empty
  summary, concurrent idempotent confirmation, changed-payload conflict, previous-month calculation,
  and cross-tenant denial.
- API tests cover authentication, missing-business state, strict request scope, and raw organization
  route guards.
- Expo web export and a real browser workflow cover onboarding, review, confirmation, canonical
  result, updated summary, and compact/wide responsive layouts.

## Official sources

- [PostgreSQL date/time functions](https://www.postgresql.org/docs/current/functions-datetime.html)
- [PostgreSQL time-zone names](https://www.postgresql.org/docs/current/view-pg-timezone-names.html)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
- [ECMA-402 currency digit rules](https://tc39.es/ecma402/#sec-currencydigits)
- [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Better Auth organization plugin](https://www.better-auth.com/docs/plugins/organization)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
