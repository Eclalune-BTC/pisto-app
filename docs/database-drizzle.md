# PostgreSQL and Drizzle

## Baseline

The active database is local PostgreSQL 18 using `postgres:18-alpine`, postgres-js and Drizzle.
No managed database is required for local operation. Hosted resources require separate approval
under [ADR 0017](adrs/0017-portable-postgres-and-hosting.md); source publication is not deployment.
`@pisto/db` owns Drizzle schema, SQL migration artifacts, database connection creation, repositories,
and transaction helpers. [Data model](data-model.md) records normalization, snapshots, constraints,
read models, and the portable migration plan.

PostgreSQL 18+ official images changed the declared data-volume layout. The Compose named volume is
mounted at `/var/lib/postgresql`, not the legacy `/var/lib/postgresql/data` target used by older
images. Do not change that target casually: inspect the official image's **PGDATA** and 18+ upgrade
notes, then test backup/restore or `pg_upgrade` migration before changing image majors. A volume mount
is persistence, not an in-place major-version upgrade plan.

The application is code-first for schema definition and migration-first for environments. Drizzle
schema changes generate reviewed SQL; runtime startup does not push or migrate the schema.

## Commands

```sh
bun run db:generate     # Generate a migration after an intentional schema change
bun run db:migrate      # Apply committed migrations to the selected DATABASE_URL
bun run db:studio       # Local inspection tool; do not expose publicly
bun run db:check        # Validate Drizzle migration consistency
```

`db:push`, if available, is restricted to disposable local databases. It bypasses the reviewed
migration artifact and is prohibited for shared, staging, and production databases.

## Change workflow

1. Change the TypeScript schema in `packages/db/src/schema`.
2. Add indexes, uniqueness, foreign-key behavior, and check constraints as part of the same design.
3. Run `bun run db:generate` once.
4. Read the generated SQL. Look specifically for locks, table rewrites, implicit casts, dropping or
   recreating objects, and accidental data loss.
5. Add migration and repository tests.
6. Run `bun run db:check`, typecheck, and tests against a fresh PostgreSQL 18 database.
7. Test upgrading a realistic previous schema/data snapshot.
8. Commit schema and generated migration together.

Never edit an already-applied migration. Add a forward migration.

## Current domain shape

- Better Auth tables persist users, sessions, accounts, verifications, organizations, members,
  invitations, and the PostgreSQL-backed `rateLimit` counters. Product request budgets reuse that
  operational table with an isolated `pisto:product:<read|write>:<userId>` key namespace.
- Billing receipt tables retain deduplication keys and provider payload evidence.
- Provider customer/subscription records are projections, not authorization by themselves.
- Entitlements enforce exactly one user/organization subject. A unique `(source, sourceId, key)`
  identity prevents the same provider grant from being projected twice; subject/status indexes serve
  authorization queries.
- `business_settings` binds create-once ISO currency, server-resolved minor-unit exponent, and an IANA
  time zone accepted by both Bun/ICU and PostgreSQL to one organization-backed business.
- `sale` stores total-only minor units as positive `bigint` plus occurrence instant, confirmed local
  date/minute, time-zone, currency/exponent snapshots, status, actor, and optional description. A
  composite foreign key prevents the sale currency/exponent from diverging from its business.
- `sale_operation` binds an actor/business UUID idempotency key and command fingerprint to the
  canonical sale. Its composite foreign key prevents cross-business audit links.
- `sale_correction` records one void or replacement per posted sale: kind, reason, actor, both sale
  references, and the same idempotency identity. Unique indexes on `(business_id, original_sale_id)`
  and `(business_id, replacement_sale_id)` mean a sale can be corrected once and a replacement cannot
  itself be corrected.
- `catalog_category` and `catalog_product` are mutable reference records with case-insensitive
  business-unique names and SKUs, a bounded unit vocabulary, quantity precision 0 through 3, an
  optional price snapshot, and archived rather than deleted state.
- `inventory_movement` is append-only. Quantity on hand is the exact sum of its signed deltas; there
  is no quantity-on-hand column. A reverse row links to the movement it negates and a uniqueness
  constraint permits that once.
- `catalog_operation` is the catalog/inventory idempotency receipt.
- `cash_account` has a name, kind, active/archived status, an explicit `allow_negative_balance`
  policy, and a currency snapshot. It deliberately has no balance column.
- `expense` stores a bounded category, positive amount, currency/time snapshots, optional payee, the
  selected account, and posted/voided state.
- `cash_movement` is the append-only cash ledger. A check constraint requires the signed
  `delta_minor_units` to agree with the `in`/`out` direction, and the action vocabulary is
  constrained to `opening`, `expense`, `adjustment_in`, `adjustment_out`, `transfer_in`,
  `transfer_out`, `receivable_payment`, and `reverse`. Account balance is the exact sum of deltas.
- `cash_transfer` owns one transfer paired with exactly one `transfer_out` and one `transfer_in`
  movement in the same transaction.
- `cash_operation_receipt` is the cash/expense idempotency receipt.
- `customer` is a mutable contact record with archived rather than deleted state.
- `receivable` stores the positive original amount, currency snapshots, posted and optional due
  dates, and posted/voided authority state. Open, paid, and overdue are derived, not columns.
- `receivable_payment` is append-only and holds either a payment or a reversal of one earlier
  payment. Composite foreign keys bind it to a same-business receivable, customer, and cash account.
- `receivable_operation` is the customers/receivables idempotency receipt.
- The public entitlement contract accepts `polar`, `revenuecat`, and reserved `manual` sources, but
  no supported manual-grant write workflow is implemented. `entitlement_source_check` restricts the
  stored `source` to that set, so an unknown source fails at write time; the billing read path still
  rejects one as corrupt.

The Drizzle schema object in `packages/db/src/schema/index.ts` is the authoritative inventory: 30
tables, of which 8 are Better Auth, 4 are billing, and 18 are Pisto business tables. Migration
`0001` created `business_settings`, `sale`, and `sale_operation`; migration `0003` created the other
14. Migration `0004` added sale-history indexes that `0009` later replaced. Migration `0005` strengthens complete optional-price
and void-record constraints without adding tables. Migration `0006` adds `sale_review`, with one
open working snapshot per actor/business, a same-business saved-sale reference and closed-key
retention. See [ADR 0018](adrs/0018-durable-sale-review.md). Migration `0007` adds
`entitlement_source_check`; it validates existing rows and fails on any other stored source rather
than rewriting it. Migration `0008` makes `cash_movement.reason` nullable for system-written
transfer and receivable movements and rewrites the English reasons the system stored before to
NULL, matching only rows whose source proves they were generated. Migration `0009` replaces the
creation-order indexes of the ledger lists with occurrence-order indexes. Drizzle applies pending
migrations in one transaction and `DROP INDEX` holds an exclusive lock, so `sale`, `expense`,
`cash_movement`, `inventory_movement` and `receivable_payment` are unavailable until every new index
is built; apply it outside business hours on large data. Apply the migrations before deploying the
code that writes NULL reasons; rerunning the three `0008` updates afterwards is safe if an older API
wrote system reasons in between. Reports add no reporting ledger or materialized balance.

Raw JSON is evidence and forward-compatibility data. Queryable authorization fields remain typed
columns with indexes; code does not scan provider JSON to authorize each request.

Calendar checks reuse the [Zod ISO date validator](https://zod.dev/api#iso-dates) through
`calendarLocalDateSchema`. Four-digit years retain their exact century; year zero is rejected
because [PostgreSQL has no year zero](https://www.postgresql.org/docs/18/datetime-input-rules.html).
`localDateSchema` remains format-only for existing record contracts. Date validation does not replace
the server's time-zone resolution or daylight-saving ambiguity checks.

## Transaction and idempotency rules

- Enforce invariants in both application code and PostgreSQL constraints where practical.
- Use one transaction when recording a webhook receipt and the derived provider/entitlement update.
- Deduplicate external events with a unique `(provider, event_key)` identity.
- Use compare-and-apply logic for provider event time/version so late events cannot regress state.
- Keep transactions short; never wait for Polar, RevenueCat, email, Storage, or Tasks inside a
  database transaction.
- Use UTC `timestamp with time zone` for instants and explicit nullable period ends for lifetime
  access.
- A sale and its operation receipt commit in one short transaction after fresh `sales:create` access is loaded.
  Exact command/key replay returns the original record; changed input conflicts. Previous-month
  summaries derive half-open business-local bounds from one database timestamp.
- Every business read and command authorizes through `authorizeBusinessAction` inside its own
  transaction: an unexpired session pointed at the business, then current membership and the named
  permissions. An expired session is `UNAUTHORIZED`; a missing membership or permission is
  `FORBIDDEN`; a record outside the active business is `NOT_FOUND`.
- Authorization holds `FOR SHARE` on the session and membership rows until commit. A role or
  active-business change is an `UPDATE` of a non-key column (`FOR NO KEY UPDATE`) and a removal is a
  `DELETE` (`FOR UPDATE`); both conflict with `FOR SHARE`, so a revocation waits for in-flight work
  and in-flight work waits for a pending revocation. `FOR KEY SHARE` would let a role downgrade
  commit mid-command; exclusive modes would serialize every command of one member. The membership
  lock protects only authorization, not a parent record a command depends on; see the parent-row rule
  below. Read-only snapshot transactions authorize without row locks because PostgreSQL
  rejects them there. Onboarding alone locks its session `FOR UPDATE`, because it rewrites that row.
- A command that checks a parent record's state before writing a child locks that parent row in a
  mode that conflicts with the parent's own state change, because a foreign-key check takes only
  `FOR KEY SHARE`, which a status-only `UPDATE` does not block. Cash accounts are locked
  `FOR NO KEY UPDATE`; customers, products, receivables, and expenses `FOR UPDATE` (a payment holds
  its customer `FOR SHARE`); and a product's category `FOR SHARE`, so a product create or
  recategorization waits for a concurrent category archive and then rejects the archived category.
- Command timestamps use the database clock. `updated_at` is set by the column's `$onUpdate`
  to `transaction_timestamp()`, and `voided_at`/`closed_at` are written the same way, so they never
  precede a `created_at` from the same clock and are stored with full microsecond precision.
- Business discovery and onboarding also verify a live, unexpired session in the database; a cached
  auth response cannot authorize a new business or replay after session expiry.
- Multi-query operating reports and customer/receivable details use a read-only repeatable-read
  transaction so their records, histories, and totals share one snapshot. Authorization is checked
  within that snapshot.
- Opaque timestamp cursors preserve PostgreSQL microseconds and encode UTC explicitly. Do not
  round a cursor through JavaScript `Date` milliseconds or rely on a connection's `TimeZone` setting.
- `pagination.ts` owns every history cursor: a versioned base64url payload bound to a fingerprint of
  the list kind and its filters, a row-value keyset predicate, and the `limit + 1` page split. Record
  lists (accounts, categories, products, customers, receivables) page by `(created_at, id)`. Ledger
  lists of things that happened (sales, expenses, cash and inventory movements) page by
  `(occurred_at, created_at, id)` with a version 2 cursor, so a backdated entry appears at its date;
  receivable payments use the same order. Each order has a tenant index that serves it without a
  sort, which an integration test checks through the query plan. A cursor of the other kind,
  replayed under other filters or tampered with is `VALIDATION_ERROR`.
- Repositories trust path identifiers the HTTP boundary already validated as UUIDs; a malformed
  identifier reaching PostgreSQL fails loudly instead of being reported as a missing record.
- Idempotency keys are normalized to lower case before the advisory lock and every receipt lookup,
  so differently cased retries of one UUID serialize on the same lock. `normalizeIdempotencyKey` is
  the only producer of the `IdempotencyKey` type that `lockCommandKey` and receipt identities
  require; the lock does not normalize again.

## Shared operation-log primitive

Every confirmed financial or inventory command writes an append-only receipt. There are five receipt
tables, one per capability, because their foreign keys and action `CHECK` constraints differ:

| Table | Capability | Actions it constrains |
| --- | --- | --- |
| `sale_operation` | Sales | `sale.posted` |
| `sale_correction` | Sale correction | `void`, `replacement` |
| `catalog_operation` | Catalog and inventory | Category, product, and movement commands |
| `cash_operation_receipt` | Cash and expenses | Account, expense, adjustment, reversal, transfer |
| `receivable_operation` | Customers and receivables | Customer, charge, payment, reversal, void |

`packages/db/src/operation-log.ts` owns only what those tables share, not the tables themselves:

- **Command identity.** `(action, actorUserId, businessId, commandFingerprint, idempotencyKey)`. The
  shared fingerprint helper hashes canonical `{ version, action, payload }` JSON with SHA-256.
  Existing owners retain their established encodings: receivables uses `{ action, payload, version }`
  and sales uses its own payload shape. Key order is part of command identity; a refactor must not
  rewrite stored fingerprints or change the serialization of retries.
- **Advisory locks.** `lockCommandKey` serializes concurrent retries of one
  business/actor/idempotency key inside the transaction, so a replay read cannot race another commit
  of the same command. `lockSemanticKey` does the same for a case-insensitive business-scoped name,
  such as a cash-account name, category name, or product SKU.
- **Replay.** `beginOperation` returns the stored result when the same actor already committed
  this exact command, and raises `IDEMPOTENCY_CONFLICT` when the key was reused for a different
  action or payload. The stored snapshot is read back through the contract the caller passes and
  fails loudly rather than replaying a corrupt one. `saveOperation` writes the receipt identity plus
  the capability's own links.
- **Descriptor shape.** `OperationLog` reads the identity columns off the table itself instead of
  taking them as separate fields. A descriptor that named them separately could point `businessId` at
  another column of the same table: it would typecheck, generate a predicate that never matches, and
  silently re-execute the command on every retry.

Cash, catalog, and receivables share one prologue, `beginOperation`, which authorizes the fresh
session and membership first, then takes the idempotency lock, then reads the replay.

Each capability lives in its own folder (`cash/`, `catalog/`, `receivables/`, `sales/`) and the
top-level `cash.ts`, `catalog.ts`, `receivables.ts` and `sales.ts` compose its factories. Every
folder has `types.ts` for the repository interface and `records.ts` for shared row reads and locks.
`cash/`, `catalog/` and `receivables/` add `mappers.ts` for record-to-contract mapping, keep their
operation-log descriptor in `records.ts`, and split work into `*-commands.ts` and `queries.ts` /
`*-queries.ts`; `cash/receivable-ledger.ts` posts receivable payments to cash, and
`receivables/codec.ts` holds the payment result schema and the receivables fingerprint encoding.
`sales/` keeps its fingerprints, key checks and record mappers in `records.ts`, with `posting.ts`,
`corrections.ts`, `reviews.ts` and `queries.ts` beside it. `businesses.ts` owns discovery and
onboarding as its own repository.
Shared primitives are `errors.ts`, `business-access.ts`, `local-time.ts`, `money.ts`,
`pagination.ts`, `operation-log.ts` and `text-search.ts`. The package index exports only what other
packages use.

### Why the two sales paths do not use `beginOperation`

`packages/db/src/sales/posting.ts` and `packages/db/src/sales/corrections.ts` deliberately do
**not** call `beginOperation`. They use `authorizeBusinessAction` and `lockCommandKey` with the same
global lock order as other commands: live session, membership, then command-key advisory lock.
Taking the command key first in either sales path would reintroduce the cross-capability deadlock
covered by the PostgreSQL regression suite. Review preparation additionally serializes on a
per-actor advisory lock before its one-open-review check, so a concurrent preparation sees the
committed review as `CONFLICT` instead of failing on the unique index.

The separate replay code remains necessary because sales share one `(business_id, actor_user_id,
idempotency_key)` space across `sale_operation` and `sale_correction`. A key used to post a sale must
conflict when reused for a correction, and the reverse. Each path therefore reads both tables;
the single-table replay in `beginOperation` cannot express that contract.

### Shared request-budget storage

`product-rate-limit.ts` atomically consumes a per-user read or write budget using PostgreSQL's
statement clock. Defaults are 300 reads and 60 writes per 60-second fixed window; API configuration
can bound the counts. A fresh random row ID avoids a second unique-index conflict during concurrent
first use, while the unique key is the upsert conflict target. Denied traffic caps the stored count
at the limit plus one. Counters are operational data, not business audit or billing usage records.

Both this product window and the configured Better Auth window are 60 seconds. The installed Better
Auth database limiter removes expired rows across the whole table using its longest configured
window; it does not filter the product namespace. Keep the product window no longer than that cleanup
window, and recheck this behavior on Better Auth upgrades or policy changes. The namespace separates
consumption, but does not isolate cleanup ownership.

## Connections

Local code uses the local `DATABASE_URL`, bounded by `DATABASE_MAX_CONNECTIONS`. Do not point local
startup or test configuration at the earlier remote database. Across multiple local processes or any
future authorized deployment, total possible connections are approximately:

```text
maximum active API instances × per-instance pool maximum
```

Keep that result below the selected database connection budget with headroom for migrations,
operations, and failover. A high HTTP concurrency setting does not justify one database connection
per request. Local migrations and backup/restore tools use a direct local connection. A future
pooler needs explicit compatibility evidence from the existing transaction tests before adoption.

Set production TLS/network behavior deliberately through `DATABASE_SSL` and the selected PostgreSQL
connection path. Do not disable certificate verification globally. A provider move changes connection
configuration and operational controls, not domain queries or the migration format.

## Production migration policy

Migration `0002` preserves the already-applied local sales migration. Its pre-release backfill derives
the missing wall-clock snapshots from each sale instant plus current business time zone and accepts
existing USD businesses only; it fails closed for any pre-existing non-USD business so its exponent
can be reviewed rather than guessed. Fresh databases still apply both migrations without a backfill
row. This is pre-release compatibility evidence, not a general future currency-migration policy.

Migration `0003_worried_weapon_omega.sql` is additive. It creates the 14 operating-core tables —
catalog, inventory, cash, expenses, receivables, and `sale_correction` — and touches no existing row.
Each `CREATE TABLE` declares its composite `(business_id, id)` uniqueness inline, and every
`ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY` follows afterwards, because PostgreSQL requires the
referenced uniqueness to exist first. Preserve that ordering in any future migration that adds a
composite tenant foreign key.

Migration `0005_require_complete_record_snapshots.sql` replaces three CHECK predicates so SQL NULL
cannot admit a partial price snapshot or a void without a reason. It fails on malformed existing
rows rather than inventing repair values. Inspect and resolve such rows from authoritative evidence
before upgrading. Fresh application, previous-schema upgrade with representative data, and repeated
migration execution are separate validation gates.

- Back up and confirm recovery objectives before a destructive or high-risk change.
- Run migrations once as a separately authorized release step with a direct URL and migration role,
  not in every API instance. Hosting does not change that separation of privilege.
- Prefer expand/migrate/contract: add compatible shape, deploy dual-compatible code, backfill, then
  remove old shape in a later release.
- Serialize migration execution in the release workflow. Drizzle's migration ledger tracks applied
  artifacts; do not treat a ledger alone as permission to run concurrent migration executors.
- Verify schema version and critical queries before shifting API traffic.
- Database rollback usually means a forward corrective migration. Do not assume application rollback
  can undo committed data changes.

## Backup and privacy

The local Docker volume persists data, but is not a backup. Keep private backups and a tested
standard `pg_dump`/`pg_restore` path; restore into an isolated database rather than overwriting the
active local database. Any future hosted environment needs explicitly selected backups/PITR,
retention, restore access, and verified recovery objectives. [Release evidence](release-evidence.md)
owns completed portability checks and their limits. Minimize stored provider
payloads, restrict access, define retention, and avoid credentials or unnecessary personal data in
JSON evidence.

Every cash command, transfers included, locks accounts through one helper with
`FOR NO KEY UPDATE` in identifier order. Account identity is immutable, so this serializes
balance-changing commands while remaining compatible with the `FOR KEY SHARE` lock a receivable
payment's foreign-key check takes on the account. Cursor validation rejects impossible calendar
dates and times before database casts without reducing the six-digit timestamp precision. Sale
detail reads the sale and its correction in one statement; posting replays include later correction
evidence. `packages/db/integration/data-hardening.integration.ts` covers these regressions.

## Official sources

- [PostgreSQL 18 documentation](https://www.postgresql.org/docs/18/)
- [PostgreSQL row-level lock modes](https://www.postgresql.org/docs/18/explicit-locking.html#LOCKING-ROWS)
- [PostgreSQL 9.3 release notes: foreign-key checks use `FOR KEY SHARE`](https://www.postgresql.org/docs/release/9.3.0/)
- [Keyset pagination with row values](https://use-the-index-luke.com/sql/partial-results/fetch-next-page)
- [PostgreSQL 18.6 release](https://www.postgresql.org/docs/release/18.6/)
- [Official PostgreSQL container image](https://hub.docker.com/_/postgres)
- [Drizzle PostgreSQL guide](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle migration fundamentals](https://orm.drizzle.team/docs/migrations)
- [Drizzle generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)
