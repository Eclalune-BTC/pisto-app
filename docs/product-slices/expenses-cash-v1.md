# Expenses and cash V1

- Status: **integrated into `main`; schema ships in migration `0003` and the routes are mounted under `/v1`**
- Capability owner: `packages/db/src/cash/*`
- Product surfaces: `/operate/expenses` and `/operate/cash`
- Last reviewed: **2026-08-22**

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
domain failures to the existing stable error contract. These routes are not reachable until the
integration owner mounts them in the shared `/v1` composition root and extends its POST security
middleware inputs.

## Product surfaces and failure states

The route-ready React Native features use shared web/native semantics and the existing ink/lime/cream
tokens. Layout uses headings, spacing, dividers, and one owned primary action. It adds no glow,
gradient, ornamental pill, fake metric, or feature-card directory.

The screens model loading, successful empty, data, denied, unavailable, failed mutation, and
uncertain confirmation separately. An uncertain mutation hides duplicate write actions and exposes
only a status/reconciliation action. The account list labels archived and explicit
negative-balance state in text rather than color alone. Expense totals are labeled recorded expenses
and explicitly do not claim profit.

The feature boundary includes route-ready screens for the expense period/list, new-expense edit and
review, expense detail and void review, cash overview, account creation/update, account detail and
archive review, adjustment edit/review, movement detail and one-time reversal review, and paired
transfer edit/review. Detail screens expose explicit navigation callbacks; they do not pretend that
live Expo routes, data hooks, or localized resources are already composed.

Visible and accessibility copy is supplied through typed props so the integration owner can add it
once to the shared `es-SV` catalog. Feature components do not hardcode visible fallback copy. The
structured route wrappers still need to bind queries, mutations, localization, permission-derived
visibility, and signed-money formatting through existing app owners.

## Integration checklist

The integration owner must complete these shared files in one reviewed change:

1. export cash contracts from `packages/contracts/src/index.ts`;
2. export the schema/repository and add cash tables to the Drizzle schema object;
3. generate and review one migration, including constraints, indexes, locks, and upgrade behavior;
4. construct one `CashRepository`, inject it into the API composition root, and mount `cashRoutes`;
5. update the API surface guide and ensure every unsafe route receives the existing JSON/origin gate;
6. add API client methods, typed `es-SV` copy, Operate navigation, and thin Expo Router wrappers;
7. compose receivable payment writes through a cash-owned transaction command rather than editing
   `cash_movement` from another module; and
8. run PostgreSQL 18, full repository, responsive web, and available native gates.

Temporary direct source imports in isolated API/UI files exist only because shared barrels are
integration-owned. Normalize them during composition.

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
