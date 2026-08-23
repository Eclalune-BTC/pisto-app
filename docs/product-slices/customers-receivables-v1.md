# Customers and receivables V1

- Status: **integrated into local `main`; schema ships in migration `0003` and the routes are mounted under `/v1`. Not pushed to `origin/main`, not deployed, not released**
- Product contract: [Operating core V1](./operating-core-v1.md#customers-and-receivables-slice)
- Owners: `packages/contracts`, `packages/db`, `apps/api`, and `apps/app`
- Last reviewed: **2026-08-23**

## Outcome

An owner or admin can keep a private customer record, post a charge for money that customer owes,
record a payment into a selected cash account, and correct history through a payment reversal or a
receivable void. Customer balances, business totals, and open, paid, overdue, and voided states are
derived from canonical charges and append-only payment history.

This is a structured manual capability. It remains usable without AI or voice. A future assistant
tool may propose the same strict commands, but it cannot select the business, calculate canonical
money, bypass review, or write these tables directly.

## Capability boundary

| Owner | Responsibility |
| --- | --- |
| `packages/contracts/src/receivables.ts` | Strict transport schemas, request types, public read models, and bounded list filters |
| `packages/db/src/schema/receivables.ts` | Customer, receivable, payment/reversal, and idempotency receipt persistence |
| `packages/db/src/receivables/**` | Fresh authorization, deterministic commands, exact replay, derived queries, and concurrency control |
| `apps/api/src/routes/receivables.ts` | Session boundary, request parsing, HTTP status mapping, and route composition module |
| `apps/app/src/features/customers/**` | Customer search, detail/history, create/update, and reviewed archive surfaces |
| `apps/app/src/features/receivables/**` | Receivable list/detail, post/payment inputs, correction inputs, and exact review surfaces |

Applications compose these owners explicitly. There is no feature registry, autonomous finance
worker, or duplicate client-side balance calculation.

## Access and privacy

- The server derives `userId`, session ID, and active organization-backed `businessId` from the
  authenticated session. No customer or receivable command accepts a tenant or actor field.
- Exact roles `owner` and `admin` receive `customers:read`, `customers:manage`,
  `receivables:read`, and `receivables:manage`. `member`, unknown roles, and composed role strings
  fail closed.
- Every repository call reloads an unexpired session and current membership inside its transaction.
  A stale session is unauthorized; a known member without access is forbidden.
- Record lookups always include the authorized business. A valid ID from another business is
  indistinguishable from an absent record and returns not found.
- Phone, email, and notes are returned only by customer-authorized reads. They must not enter logs,
  analytics, error details, generic assistant context, or model tool output. Exact command replay
  receipts contain the minimum result snapshot needed for deterministic replay and require the same
  database access controls and retention policy as the canonical contact record.

## Canonical data

### Customer

`customer` stores a business-scoped UUID, trimmed name, optional phone/email/notes, active or
archived status, and timestamps. A customer may be archived, never hard-deleted through this slice.
History remains readable after archival. Updating an archived customer, posting a new charge for it,
or applying a new payment to one of its receivables conflicts. A correction reversal remains allowed
so recorded financial history can be repaired.

### Receivable

`receivable` stores business and customer identity, positive original amount in exact minor units,
currency and exponent snapshots, description, posted date, optional due date, posted/voided
authority state, actor evidence, void reason/evidence, and timestamps. Due date cannot precede posted
date. Public `open`, `paid`, and `overdue` states are not mutable columns.

### Payment and reversal

`receivable_payment` is append-only. A row is either:

- `payment`: a positive amount applied to one receivable; or
- `reversal`: a positive correction linked to one original payment.

Both retain business, customer, receivable, currency/exponent, confirmed local date/minute, resolved
instant, IANA zone, actor, optional reference, and selected cash-account identity. A unique partial
constraint allows an original payment to be reversed only once. Composite foreign keys prevent
cross-business, cross-customer, and cross-receivable links.

### Operation receipt

`receivable_operation` binds `(businessId, actorUserId, idempotencyKey)` to one action, SHA-256
command fingerprint, canonical target IDs, and exact JSON result snapshot. The snapshot is audit and
replay evidence, not an authorization source or a queryable balance store.

## Money and business time

- `business_settings` supplies the business-selected ISO 4217 currency, server-resolved minor-unit
  exponent, and IANA time zone. No currency or time zone is hardcoded in this capability.
- Commands accept canonical decimal strings in minor units. JavaScript floating-point values never
  own financial arithmetic.
- Each charge and payment snapshots currency and exponent. Composite database constraints keep those
  snapshots equal to the owning business currency in V1.
- New financial records are blocked by the shared business policy if an operating-currency change
  would rewrite existing history. Future conversion needs its own effective-dated transition.
- The server resolves payment local date and minute in the business time zone. Ambiguous or
  nonexistent local minutes fail validation instead of being guessed.
- Overdue means a posted receivable has positive outstanding value and `dueDate` is strictly before
  the current business-local date. A receivable due today is not overdue.

## Derived invariants

For a posted receivable:

```text
paid = sum(payment amounts) - sum(reversal amounts)
outstanding = original amount - paid
```

`paid` and `outstanding` cannot be negative. Public state is derived in this order:

1. authority status `voided` -> `voided`, with public outstanding `0`;
2. outstanding `0` -> `paid`;
3. positive outstanding and due date before business-local today -> `overdue`;
4. otherwise -> `open`.

Customer and business totals sum posted receivables only. They do not store a writable balance and
do not claim revenue, profit, cash-on-hand, bank reconciliation, tax, or fiscal invoice state.

## Commands

All commands reject unknown fields, require a caller-created UUID idempotency key, and run in one
short PostgreSQL transaction after fresh authorization.

| Command | Required behavior |
| --- | --- |
| Create customer | Persist an active customer and replay the exact original result |
| Update customer | Change at least one supplied field; explicit `null` clears an optional contact field |
| Archive customer | Preserve the record and history; an exact replay remains successful |
| Post receivable | Require an active same-business customer, positive exact amount, and valid dates; snapshot business currency |
| Apply payment | Lock the receivable, require active customer/posted state, ensure amount is at most outstanding, resolve local time, and persist the selected `cashAccountId` |
| Reverse payment | Lock the receivable, copy amount/currency/cash-account identity from the original payment, and append one reversal |
| Void receivable | Require a posted receivable and zero net paid amount; preserve the explicit reason and void evidence |

Before command work, the transaction takes an advisory lock scoped to business, actor, and
idempotency key. An existing receipt with the same action and fingerprint returns its stored result
with `replayed: true`. Reuse with changed input or action returns `IDEMPOTENCY_CONFLICT`.

Payment commands also lock the receivable row. Concurrent payments therefore observe a serialized
outstanding amount; if two payments would collectively overpay, at most the valid one commits and the
other conflicts. Database constraints independently protect positive amounts, target identity,
snapshot consistency, reversal shape, and reversal-once behavior.

## Queries

- List/search customers by name, phone, or email with active/archived/all status.
- Read customer detail and derived outstanding/overdue totals.
- List receivables by customer and derived state.
- Read one receivable with append-only payment/reversal history.
- Read business outstanding/overdue totals and the business-local date used for the result.

Lists use a bounded limit of 1 through 50, default 25, deterministic `(createdAt, id)` descending
order, and an opaque cursor cryptographically bound to its filters. A cursor reused with different
filters is invalid, not an empty page.

## HTTP surface

`apps/api/src/routes/receivables.ts` is mounted under `/v1` in `apps/api/src/routes/v1.ts`. Every
route below is reachable.

| Method | Path | Permission | Result |
| --- | --- | --- | --- |
| `GET` | `/customers` | `customers:read` | Searchable customer page |
| `POST` | `/customers` | `customers:manage` | Create/replay customer |
| `GET` | `/customers/:customerId` | `customers:read` | Customer and derived balance |
| `POST` | `/customers/:customerId/update` | `customers:manage` | Update/replay customer |
| `POST` | `/customers/:customerId/archive` | `customers:manage` | Archive/replay customer |
| `GET` | `/receivables` | `receivables:read` | Filtered receivable page |
| `GET` | `/receivables/summary` | `receivables:read` | Business totals |
| `POST` | `/receivables` | `receivables:manage` | Post/replay charge |
| `GET` | `/receivables/:receivableId` | `receivables:read` | Charge and payment history |
| `POST` | `/receivables/:receivableId/void` | `receivables:manage` | Void/replay charge |
| `POST` | `/receivables/:receivableId/payments` | `receivables:manage` and `cash:manage` | Apply/replay payment |
| `POST` | `/receivable-payments/:paymentId/reverse` | `receivables:manage` and `cash:manage` | Reverse/replay payment |

Successful responses use `{ data: ... }`. Validation is 400, absent session 401, known denied
membership 403, undisclosed resource 404, invariant/idempotency conflict 409, and unexpected
dependency failure 500 through the shared error boundary. Shared `/v1` middleware owns exact-origin
protection, JSON enforcement, request IDs, redaction, and `Cache-Control: no-store`.

## Product surfaces

`/operate/customers` composes customer search/list, customer detail with contact and balance,
receivable history, create/update form, and reviewed archive. `/operate/receivables` composes the
business summary, state filter/list, receivable detail and payment history, charge and payment forms,
void and reversal forms, and the four explicit post/void/payment/reversal review panels.

Shared React Native components serve web and native. Route adapters own fetching, local form state,
UUID creation, localized copy, date/money formatting, customer/cash-account labels, and navigation.
The components do not show raw account UUIDs, invent missing customer names, or duplicate server
money logic.

Read states distinguish loading, successful empty, ready, stale, offline, denied, not found, and
error. Write states distinguish review, submitting, confirmed, rejected, and uncertain outcome. An
uncertain outcome can retry only the exact same serialized command and idempotency key; editing the
input requires a new review and key. Financial actions are not offered from denied, failed, or
unconfirmed reads.

The surfaces preserve the Pisto ink/lime/cream language with responsive rows, type hierarchy,
spacing, and dividers. They add no glow, gradient, decorative metric, floating card, ornamental pill,
or unowned success state.

## Explicit failures

The caller must handle invalid contact or dates, archived-customer mutation, currency mismatch,
unknown/archived cash account, overpayment, payment on a voided receivable, void before active
payments are reversed, repeated reversal, changed-input idempotency reuse, stale access,
cross-tenant not found, offline reads, and uncertain network confirmation. None becomes an empty
success, guessed time, implicit account, or locally invented balance.

## Integration record

Integration is complete and the cash seam is closed. Every item the original pre-mount checklist
listed is satisfied on the current branch:

1. the contract and the database schema/repository are exported through the shared
   `packages/contracts/src/index.ts` and `packages/db/src/index.ts` barrels; no temporary direct
   source import remains;
2. migration `0003_worried_weapon_omega.sql` carries `customer`, `receivable`,
   `receivable_payment`, and `receivable_operation`, and CI applies the committed migrations to a
   clean PostgreSQL 18 service before the integration suites run;
3. `receivablesRoutes` is registered in the `/v1` composition root in `apps/api/src/routes/v1.ts`;
4. Expo Router wrappers under `apps/app/src/app/(app)/operate/customers` and
   `apps/app/src/app/(app)/operate/receivables`, API client functions, typed `es-SV` resource keys,
   and `/operate` hub entries gated on `customers:read` and `receivables:read` all exist. No module
   received its own permanent bottom tab;
5. the composite same-business foreign key `receivable_payment_business_cash_account_fk` binds
   `(business_id, cash_account_id)` to `(cash_account.business_id, cash_account.id)`, so a payment
   cannot reference another business's account or a nonexistent one; and
6. a payment and its positive `receivable_payment` cash movement — and a reversal and its opposing
   movement — commit in the same transaction and under the same operation receipt. The write crosses
   the boundary through the cash-owned port `appendReceivablePaymentCashMovement` in
   `packages/db/src/cash/receivable-ledger.ts`, which locks the account, rejects a currency or
   exponent mismatch, and appends the movement. The receivables module never edits `cash_movement`
   directly. This is the owner-port pattern ratified by
   [ADR 0016](../adrs/0016-owner-ports-for-cross-capability-transactions.md).

Responsive-web and physical-device evidence for these screens is not recorded here. Treat those as
outstanding acceptance checks, not as completed gates.

## Validation evidence

Focused automated coverage includes strict contract rejection, schema invariants, derived states,
HTTP parsing/error mapping, UI state truth, exact replay and changed-input conflict, owner/admin/member
access, unknown-role denial, stale session denial, tenant contact isolation, archived-customer
behavior, concurrent overpayment rejection, reversal once, void-after-reversal, and business-local
overdue calculation.

The isolated repository test originally ran against a disposable PostgreSQL 18 database using a
generated scratch migration. That scratch SQL has been superseded: `packages/db/integration/receivables.integration.ts`
now runs against the committed migrations, and CI applies them to a clean PostgreSQL 18 service
before the suite. Local tests do not claim push, deployment, or release.

## Non-goals

Credit scoring, interest, automated collection messages, fiscal invoices, tax calculation,
suppliers, payables, contact synchronization, bank synchronization, write-offs, partial currency
conversion, autonomous assistant settlement, RAG, and graph storage are excluded.

## Sources

Repository decisions:

- [Operating core V1](./operating-core-v1.md)
- [Product capability architecture](../product-capability-architecture.md)
- [PostgreSQL and Drizzle](../database-drizzle.md)
- [API and Hono](../api-hono.md)
- [Expo UI language](../frontend-expo-ui.md)
- [ADR 0010: organization-backed business tenancy](../adrs/0010-organization-backed-business-tenancy.md)
- [ADR 0011: modular capabilities and application-owned composition](../adrs/0011-modular-capabilities-and-app-owned-composition.md)
- [ADR 0014: static current-operation permissions](../adrs/0014-static-current-operation-permissions.md)

Primary references:

- [PostgreSQL 18 row-level locks](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
- [PostgreSQL 18 constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [Hono validation](https://hono.dev/docs/guides/validation)
- [Better Auth organization access control](https://www.better-auth.com/docs/plugins/organization#access-control)
- [OWASP logging data exclusions](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html#data-to-exclude)
