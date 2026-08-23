# Expenses and cash V1

- Status: **integrated into local `main`; schema ships in migration `0003` and the routes are mounted under `/v1`. Not pushed to `origin/main`, not deployed, not released**
- Capability owner: `packages/db/src/cash/*`
- Product surfaces: `/operate/expenses` and `/operate/cash`
- Last reviewed: **2026-08-23**

This slice lets an owner or admin define where the business holds money, post and void a paid
expense, correct a cash count, transfer money between accounts, and inspect exact derived balances
and expense totals. It implements the frozen Expenses and cash contract in
[Operating core V1](operating-core-v1.md). Revenue, expenses, and cash remain different concepts.

## User-owned currency and time

Currency is not a Pisto global and is not hardcoded to USD. The user selects the business operating
currency and IANA time zone during business setup. `business_settings` remains authoritative for new
records. Every account, expense, transfer, and movement snapshots the confirmed currency,
minor-unit exponent, local date, local minute, time zone, and resolved instant.

Financial commands carry the currency that the user reviewed. The server compares it with the fresh
business setting and fails on a mismatch; it never converts or silently substitutes currency. The
operating currency cannot change after financial records exist under V1. Amounts cross JSON as
canonical decimal strings in minor units and become `bigint` only inside deterministic domain code.
Ambiguous, nonexistent, and invalid business-local minutes fail rather than being guessed.

## Capability ownership

| Concern | Owner |
| --- | --- |
| Transport schemas and public types | `packages/contracts/src/cash.ts` |
| PostgreSQL tables and constraints | `packages/db/src/schema/cash.ts` |
| Session, membership, permission, balance, and operation policy | `packages/db/src/cash/access.ts` |
| Money, fingerprint, date, cursor, and replay codecs | `packages/db/src/cash/codec.ts` |
| Public record mapping | `packages/db/src/cash/mappers.ts` |
| Account commands | `packages/db/src/cash/account-commands.ts` |
| Paid-expense commands | `packages/db/src/cash/expense-commands.ts` |
| Adjustment, reversal, and transfer commands | `packages/db/src/cash/movement-commands.ts` |
| Tenant-scoped account, movement, expense, and period queries | `packages/db/src/cash/queries.ts` |
| HTTP validation/error boundary | `apps/api/src/routes/cash.ts` |
| Shared responsive presentation and confirmation states | `apps/app/src/features/cash` and `apps/app/src/features/expenses` |

`packages/db/src/cash.ts` is the explicit facade. The module has no registry, event bus, generic
service layer, or provider abstraction. Applications remain responsible for composition.

## Canonical data and ledger rules

### Cash account

A cash account has a business-scoped UUID, case-insensitive business-unique name, kind, active or
archived state, explicit negative-balance policy, currency snapshot, creator, and timestamps. It has
no mutable balance column. Creation requires the caller to state either a reviewed opening movement
or explicit `null` for a zero start.

### Expense

A paid expense stores its stable category, positive exact amount, currency/time snapshots,
description, optional payee, selected account, actor, and posted/voided state. Posting the expense
and its negative cash movement is one transaction. Voiding appends one positive reversal movement
and marks the expense voided in one transaction; it does not delete or overwrite history.

### Cash movement

Each movement stores a positive amount, explicit direction, signed derived delta, action, account,
currency/time snapshots, reason, actor, and an applicable source link. Database checks require the
direction and delta to agree and require the source shape for expenses, transfers, receivable
payments, and reversals. Account balance is the exact sum of movement deltas. A reversal points to
the original movement through a business-scoped foreign key and a uniqueness constraint permits it
once.

### Transfer and operation receipt

A transfer owns one canonical transfer record and exactly one `transfer_out` plus one `transfer_in`
movement in the same transaction. Accounts are row-locked in deterministic UUID order to avoid
opposing-transfer deadlocks. The source account applies its explicit negative-balance policy.

Every mutation stores an append-only operation receipt keyed by business, actor, and caller-created
UUID. The SHA-256 fingerprint binds the action and normalized command payload. Exact replay parses
and returns the stored result snapshot with `replayed: true`; changed input or another action with
the same key returns `IDEMPOTENCY_CONFLICT`. This preserves the original response even if a mutable
account changes later.

## Commands

| Command | Permission | Atomic effect |
| --- | --- | --- |
| Create account | `cash:manage` | Account plus optional opening movement plus receipt |
| Update account | `cash:manage` | Name/kind/negative policy plus receipt |
| Archive account | `cash:manage` | Archived reference record plus receipt; history remains |
| Post paid expense | `expenses:manage` and `cash:manage` | Expense, negative movement, receipt |
| Void paid expense | `expenses:manage` and `cash:manage` | Expense state, reversal movement, receipt |
| Record adjustment | `cash:manage` | Positive or protected negative movement plus receipt |
| Reverse adjustment | `cash:manage` | Opposite movement once plus receipt |
| Transfer | `cash:manage` | Transfer, paired movements, receipt |

Every command reloads an unexpired session whose active organization matches the server-resolved
business, locks the current membership, checks the centralized exact role permission, and then
checks replay state. Owner and admin are allowed. Member and unknown/composed roles fail closed.
Correction of historical expenses and adjustments remains possible after an account is archived;
new expenses, adjustments, and transfers require active accounts.

## Queries

- List active, archived, or all accounts with exact derived balances and an opaque bounded cursor.
- Read one tenant-scoped account.
- List expenses by status, category, or account with an opaque bounded cursor.
- Read one tenant-scoped expense.
- List movements globally or for one account with an opaque bounded cursor.
- Calculate posted expense total, count, and category breakdown for an inclusive business-local date
  range using half-open UTC boundaries.

Lists default to 25 and accept 1 through 50 records. Creation time and UUID form the deterministic
descending order. Invalid cursors and impossible dates are validation errors. A valid empty query
returns real empty items or zero totals; authorization, database, and network failures do not become
empty data.

## HTTP composition seam

`apps/api/src/routes/cash.ts` provides route-ready Hono composition for:

- `GET/POST /v1/cash/accounts`
- `GET /v1/cash/accounts/:accountId`
- `POST /v1/cash/accounts/:accountId/update`
- `POST /v1/cash/accounts/:accountId/archive`
- `GET /v1/cash/movements`
- `POST /v1/cash/movements/:movementId/reverse`
- `POST /v1/cash/adjustments`
- `POST /v1/cash/transfers`
- `GET/POST /v1/expenses`
- `GET /v1/expenses/:expenseId`
- `POST /v1/expenses/:expenseId/void`
- `GET /v1/expenses/summary`

All mutation bodies reject unknown fields and all identifiers are UUIDs. The route boundary maps
domain failures to the existing stable error contract. `cashRoutes` is mounted in the shared `/v1`
composition root in `apps/api/src/routes/v1.ts`, so every route above is reachable and inherits the
`/v1` origin/JSON gate, request ID, and `Cache-Control: no-store` behavior. The router deliberately
registers no `onError` of its own; the single translation boundary lives in `apps/api/src/app.ts`.
The complete mounted surface is inventoried in [API and Hono](../api-hono.md).

## Product surfaces and failure states

The route-ready React Native features use shared web/native semantics and the existing ink/lime/cream
tokens. Layout uses headings, spacing, dividers, and one owned primary action. It adds no glow,
gradient, ornamental pill, fake metric, or feature-card directory.

The screens model loading, successful empty, data, denied, unavailable, failed mutation, and
uncertain confirmation separately. An uncertain mutation hides duplicate write actions and exposes
only a status/reconciliation action. The account list labels archived and explicit
negative-balance state in text rather than color alone. Expense totals are labeled recorded expenses
and explicitly do not claim profit.

The feature boundary covers the expense period/list, new-expense edit and review, expense detail and
void review, cash overview, account creation/update, account detail and archive review, adjustment
edit/review, movement detail and one-time reversal review, and paired transfer edit/review. Each has
a live Expo Router file under `apps/app/src/app/(app)/operate/expenses` and
`apps/app/src/app/(app)/operate/cash`; the route file is a thin wrapper and the controller owns
fetching, mutations, and navigation.

Visible and accessibility copy is supplied through typed props and resolved from the shared typed
`es-SV` catalog in `apps/app/src/i18n/resources`. Feature components do not hardcode visible fallback
copy.

## Integration record

Integration is complete. Every item the original checklist assigned to the integration owner is
satisfied on the current branch:

1. cash contracts are exported from `packages/contracts/src/index.ts`;
2. the schema and repository are exported from `packages/db/src/index.ts`, and `cash_account`,
   `expense`, `cash_transfer`, `cash_movement`, and `cash_operation_receipt` are in the shared
   Drizzle schema object;
3. migration `0003_worried_weapon_omega.sql` carries the tables, constraints, and indexes;
4. one `CashRepository` is constructed at the API composition root and `cashRoutes` is mounted in
   `apps/api/src/routes/v1.ts`;
5. [API and Hono](../api-hono.md) inventories every route, and the shared `/v1` middleware applies
   the origin and JSON gate to every unsafe method;
6. API client methods, typed `es-SV` copy, the `/operate` module entries for `cash:read` and
   `expenses:read`, and thin Expo Router wrappers all exist;
7. receivable payment writes go through the cash-owned `appendReceivablePaymentCashMovement` port in
   `packages/db/src/cash/receivable-ledger.ts`, not a direct `cash_movement` edit from another
   module; and
8. `packages/db/integration/cash.integration.ts` runs against PostgreSQL 18 in CI after migrations,
   alongside the product, catalog, and receivables suites.

No temporary direct source imports remain; the API and UI consume the shared barrels.

Responsive-web and physical-device evidence for these screens is not recorded here. Treat those as
outstanding acceptance checks, not as completed gates.

## Evidence and non-goals

Focused tests cover strict contracts, exact int64 money, fingerprint/cursor/date codecs, route
validation and error mapping, denied/uncertain UI state policy, and PostgreSQL scenarios for replay,
changed-input conflict, forced atomic rollback, transfer pairing, protected/allowed-negative
balances, reversal once, currency/time boundaries, exact roles, and cross-tenant isolation.

Bank synchronization, a chart of accounts, bank reconciliation claims, tax calculation, payroll
calculation, accounts payable, foreign-exchange conversion, automatic revenue-to-cash inference,
and profit claims are excluded.

## Primary references

- [PostgreSQL transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html)
- [PostgreSQL explicit locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Drizzle transactions](https://orm.drizzle.team/docs/transactions)
- [Hono validation](https://hono.dev/docs/guides/validation)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
