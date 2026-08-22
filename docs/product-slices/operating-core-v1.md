# Operating core V1 capability contracts

- Status: **approved for implementation**
- Owner: **repository owner and integration lead**
- Last reviewed: **2026-08-22**
- Applies to: catalog, inventory, expenses, cash, customers, receivables, reports, assistant, and voice

This milestone turns Pisto from one sales increment into a useful modular operating product. It is
still one Expo client, one Hono API, and one PostgreSQL database. Each capability owns its records,
commands, queries, and failure behavior; applications compose those capabilities explicitly.

## Shared product decisions

### Business currency and time

- The user chooses one supported ISO 4217 currency and one IANA time zone when creating a business.
  Neither value is a global application constant.
- `business_settings` is the current authority for new records. Every canonical money record also
  snapshots the currency and minor-unit digits it was confirmed with.
- JSON carries money as canonical decimal strings in minor units. JavaScript floating-point numbers
  never own authoritative money.
- V1 does not allow changing the operating currency after financial records exist. A future currency
  change must be a separately approved transition with an effective instant, historical snapshots,
  and no implicit conversion or rewrite. This restriction protects modularity and history; it does
  not hardcode USD or another currency.
- Business-local calendar input is resolved by the server. Financial records snapshot the confirmed
  local date, minute, IANA zone, and resolved instant. Ambiguous or nonexistent local minutes fail
  validation instead of being guessed.

### Tenancy, permissions, and commands

- The server resolves the actor and active organization-backed `businessId` from a fresh session.
  Clients, models, transcripts, and route parameters cannot choose an authorization scope.
- Only exact Better Auth roles `owner`, `admin`, and `member` are recognized. Unknown or composed
  role strings fail closed.
- Owner and admin manage catalog, inventory, expenses, cash, customers, receivables, and full
  reports. Member can read catalog and stock and keeps the already-approved sales workflow. Sensitive
  cash, expense, receivable, and complete-report access is denied until a later role brief says
  otherwise.
- Every persisted financial or inventory command uses a caller-created UUID idempotency key, strict
  unknown-field rejection, fresh permission checks, deterministic validation, one transaction, and
  an append-only operation receipt. Exact replay returns the original result; changed input conflicts.
- Deletes do not erase business history. Mutable reference records can be updated or archived;
  ledgers are corrected with explicit reversing entries or domain-specific void commands.

### API and list behavior

- Domain routes live under `/v1` and return `{ data: ... }`; errors use the existing stable envelope.
- List queries use an optional opaque cursor and a bounded `limit` from 1 through 50, default 25.
  Results are ordered deterministically by creation time and ID. Invalid cursors are validation
  errors, not empty results.
- Every list distinguishes successful empty data from denied, unavailable, malformed, and network
  states. Every `/v1` response remains `Cache-Control: no-store`.

### Product composition

- Compact navigation has the durable destinations `Operate`, `Assistant`, and `Account`. Wide web
  may show nested links for the real Operate modules. Modules do not receive one permanent bottom tab
  each and no generic plugin registry self-registers routes, tools, or permissions.
- Structured screens remain fully usable when AI or voice is disabled. Assistant tools call the same
  authorized commands and queries.
- Pisto keeps the ink/lime/cream palette. Screens use typography, spacing, alignment, dividers, and
  purposeful containment before cards. No glow, floating decorative cards, fake metrics, ornamental
  pills, or unowned buttons.
- Shared React Native code owns semantics and responsive behavior. Platform adapters are allowed
  only for real capabilities such as audio capture, files, scanner/camera, or navigation chrome.

## Catalog and inventory slice

### User job and end state

An owner or admin creates categories and products, then records stock entering or leaving. A member
can find active products and see the exact derived stock balance. The result is persisted catalog
state plus an append-only stock movement, not a directly editable quantity.

### Canonical data

- Category: business-scoped UUID, trimmed name, active/archived state, timestamps.
- Product: business-scoped UUID, optional category, name, optional case-insensitive business-unique
  SKU, optional current selling price, unit kind, quantity precision from 0 through 3, tracked flag,
  optional low-stock threshold, active/archived state, timestamps.
- Inventory movement: business, product, action (`receive`, `adjust_in`, `adjust_out`, or `reverse`),
  positive quantity expressed as exact fixed-scale minor quantity units, signed derived delta,
  reason, occurrence snapshots, actor, optional reversal link, and creation time.
- Inventory operation: actor/business/idempotency identity, command fingerprint, action, movement.
- Quantity on hand is `sum(delta)` for non-reversed history. An outbound command that would make a
  tracked product negative conflicts while holding the product's transaction lock.

### Commands and queries

- Create, update, and archive a category.
- Create, update, and archive a product. Archiving never removes its history.
- Record or reverse a manual inventory movement. A reversal can happen once and references the
  original movement.
- List/search categories and products; get product detail; list product movements; query stock and
  low-stock products.

### Product surface and failures

- `/operate/catalog` contains product search, category filtering, truthful empty state, and owned
  create actions. Product detail owns edit/archive actions.
- `/operate/inventory` shows derived stock and low-stock state; product history owns receive/adjust
  and reversal actions with review before confirmation.
- Invalid precision, archived product mutation, duplicate SKU/name, insufficient stock, repeated
  reversal, stale access, and uncertain network confirmation are explicit states.

### Non-goals

Variants, bundles, barcodes, suppliers, purchase orders, cost layers, tax, and automatic sale stock
deduction are not silently approximated in this slice.

## Expenses and cash slice

### User job and end state

An owner or admin creates the real account where money is held, records a paid expense, records a
manual correction, or transfers money between accounts. Account balances are derived from movements.
Revenue, expenses, and cash remain different concepts.

### Canonical data

- Cash account: business-scoped UUID, name, kind (`cash`, `bank`, `mobile_money`, `other`),
  active/archived state, timestamps. An opening balance is a movement, never a mutable column.
- Expense: business-scoped UUID, stable category (`inventory`, `rent`, `utilities`, `payroll`,
  `transport`, `marketing`, `tax`, `other`), positive amount, currency snapshots, description/payee,
  occurrence snapshots, selected cash account, posted/voided state, actor, timestamps.
- Cash movement: account, direction, positive amount, signed derived delta, action (`opening`,
  `expense`, `adjustment_in`, `adjustment_out`, `transfer_in`, `transfer_out`,
  `receivable_payment`, `reverse`), occurrence snapshots, source link, transfer pair, actor, timestamps.
- Operation receipts bind idempotency keys to expense, movement, transfer, and reversal results.
- Account balance is an exact sum of movement deltas. V1 does not claim a bank-reconciled balance.

### Commands and queries

- Create/update/archive cash accounts and record an explicit opening movement.
- Post or void a paid expense; the expense and its cash movement commit atomically.
- Record/reverse a manual adjustment.
- Transfer between two different active accounts as one transaction with paired movements.
- List expenses, accounts, and movements; get expense/account details; query period expense totals,
  category breakdown, and current account balances.

### Product surface and failures

- `/operate/expenses` owns expense history and the reviewed post/void flow.
- `/operate/cash` owns accounts, balances, movement history, adjustments, and transfers.
- Missing/archived account, currency mismatch, duplicate account name, invalid amount/date, same-account
  transfer, insufficient cash when a protected outflow would go negative, and uncertain confirmation
  are explicit. V1 permits an owner/admin to mark an account as allowing negative balances only
  through an explicit account setting; there is no hidden overdraft fallback.

### Non-goals

Bank synchronization, accounting chart of accounts, taxes, payroll calculation, accounts payable,
and automatic inference that revenue equals cash are excluded.

## Customers and receivables slice

### User job and end state

An owner or admin records a customer, posts money that customer owes, and applies a payment. The
customer's outstanding balance and overdue state are derived from charges and payments.

### Canonical data

- Customer: business-scoped UUID, name, optional phone/email/notes, active/archived state, timestamps.
- Receivable: business/customer IDs, positive original amount, currency snapshots, description,
  posted date, optional due date, open/voided state, actor, timestamps.
- Receivable payment: business/receivable/customer, positive amount, occurrence snapshots, optional
  reference, selected cash account, actor, timestamps, and optional reversal link.
- The outstanding amount is original amount minus non-reversed payments. Payment cannot exceed the
  outstanding amount. Open, paid, overdue, and voided are derived from authoritative state and the
  business-local date.
- Confirmed payment and its positive `receivable_payment` cash movement commit atomically; neither
  capability edits the other's ledger through an unowned shortcut.

### Commands and queries

- Create, update, archive, list, search, and read a customer.
- Post/void a receivable; apply/reverse a payment with exact replay behavior.
- List/filter receivables; get customer history; query customer and business outstanding/overdue totals.

### Product surface and failures

- `/operate/customers` owns search, customer detail, contact fields, and receivable history.
- `/operate/receivables` owns open/overdue review and the reviewed charge/payment flows.
- Archived customer mutation, currency mismatch, invalid due date, overpayment, repeated reversal,
  missing cash account, stale access, and uncertain confirmation are explicit states. Contact fields
  never appear in logs or model tool output unless the exact tool requires them.

### Non-goals

Credit scoring, interest, automated collection messages, invoices with fiscal validity, suppliers,
payables, and contact syncing are excluded.

## Reports slice

### User job and exact facts

An owner or admin chooses a valid business-local inclusive date range and sees exact facts from
posted records: gross sales revenue and count, recorded paid expenses and category breakdown, cash
inflow/outflow/net movement by account, current stock/low-stock counts, and outstanding/overdue
receivables. Daily series use half-open UTC bounds derived from the business time zone.

Reports never call gross revenue or revenue minus recorded expenses `profit`. Product cost and a
complete accounting model do not yet exist. A successful no-record query returns real zeros; a query
failure is an error and never becomes zero data.

The structured surface is `/operate/reports`. The assistant consumes the same report query through a
narrow read tool. CSV export, tax reports, forecasts, and invented trends are non-goals.

## Assistant and voice slice

The assistant provides persistent business-scoped text conversations and authorized read tools for
sales, reports, catalog/stock, expenses/cash, and receivables. Mutation-capable intent produces a
strict typed proposal; the model never writes a ledger. The user edits and explicitly confirms the
proposal, after which the normal command performs fresh authorization, validation, idempotency,
transaction, and audit.

One server-side provider/model alias registry owns model selection. There is one configured provider
at a time and no silent fallback. Missing configuration, provider timeout, rate limit, invalid model
output, and tool denial produce explicit degraded/error states while manual screens keep working.
Transactional facts come from relational queries. RAG, vectors, Neo4j, GraphRAG, arbitrary SQL/HTTP
tools, and autonomous financial execution remain excluded.

Voice V1 is bounded push-to-talk. A visible control records, stops, cancels, uploads to an
authenticated server adapter, and receives an editable transcript in the same assistant composer.
It never listens in the background and never submits a transcript automatically. Permission denied,
unsupported format/device, silence, size/duration limit, offline, upload, timeout, rate limit,
provider failure, cancellation, and retry are explicit. Raw audio is temporary and deleted after
transcription unless a separately approved retention setting exists. TTS and realtime/full-duplex
conversation remain separate future capabilities.

## Integration and release evidence

- Each parallel writer uses a separate branch/worktree and disjoint files. The integration lead owns
  shared exports, route registration, permission composition, migration generation, navigation,
  localization, and cross-capability transactions.
- Validation includes strict contract tests, permission/cross-tenant denial, idempotent replay and
  changed-input conflict, transaction rollback, precision/time-zone boundaries, ledger concurrency,
  responsive loading/empty/error/denied states, keyboard/accessibility checks, and independent review.
- `bun run check`, build, migration consistency, PostgreSQL 18 integration, web browser, and available
  native checks must pass before the milestone is called locally validated. This milestone excludes
  deployment, store submission, and a production-release claim.

## Sources

- [ADR 0011: modular capabilities and app-owned composition](../adrs/0011-modular-capabilities-and-app-owned-composition.md)
- [ADR 0015: business-owned currency and immutable money snapshots](../adrs/0015-business-owned-currency-and-money-snapshots.md)
- [Better Auth organization plugin](https://www.better-auth.com/docs/plugins/organization)
- [Drizzle ORM transactions](https://orm.drizzle.team/docs/transactions)
- [Drizzle indexes and constraints](https://orm.drizzle.team/docs/indexes-constraints)
- [PostgreSQL explicit and advisory locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL numeric types](https://www.postgresql.org/docs/current/datatype-numeric.html)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [OpenAI Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)
- [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/)
