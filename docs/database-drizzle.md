# PostgreSQL and Drizzle

## Baseline

Local development uses the official `postgres:18-alpine` image. Production uses Cloud SQL for
PostgreSQL. `@pisto/db` owns Drizzle schema, SQL migration artifacts, database connection creation,
repositories, and transaction helpers.

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
  invitations, and the PostgreSQL-backed `rateLimit` counters.
- Billing receipt tables retain deduplication keys and provider payload evidence.
- Provider customer/subscription records are projections, not authorization by themselves.
- Entitlements have exactly one subject: a user or an organization.
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
  no supported manual-grant write workflow is implemented.

The Drizzle schema object in `packages/db/src/schema/index.ts` is the authoritative inventory: 29
tables, of which 8 are Better Auth, 4 are billing, and 17 are Pisto business tables. Migration
`0001` created `business_settings`, `sale`, and `sale_operation`; migration `0003` created the other
14.

Raw JSON is evidence and forward-compatibility data. Queryable authorization fields remain typed
columns with indexes; code does not scan provider JSON to authorize each request.

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
- Protected sale reads and summaries compose an unexpired session plus an exact recognized membership
  with the required Pisto permission into the same SQL statement that reads financial data, avoiding
  an authorization/read gap.

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
  fingerprint is SHA-256 over the canonical `{ version, action, payload }` JSON, so key order is part
  of the identity.
- **Advisory locks.** `lockCommandKey` serializes concurrent retries of one
  business/actor/idempotency key inside the transaction, so a replay read cannot race another commit
  of the same command. `lockSemanticKey` does the same for a case-insensitive business-scoped name,
  such as a cash-account name, category name, or product SKU.
- **Replay.** `findOperationReplay` returns the stored result when the same actor already committed
  this exact command, and raises `IDEMPOTENCY_CONFLICT` when the key was reused for a different
  action or payload. `parseReplaySnapshot` reads a stored snapshot back through its public contract
  and fails loudly rather than replaying a corrupt one.
- **Descriptor shape.** `OperationLog` reads the identity columns off the table itself instead of
  taking them as separate fields. A descriptor that named them separately could point `businessId` at
  another column of the same table: it would typecheck, generate a predicate that never matches, and
  silently re-execute the command on every retry.

Cash, catalog, and receivables share one prologue, `beginOperation`, which authorizes the fresh
session and membership first, then takes the idempotency lock, then reads the replay.

### Why the two sales paths do not use `beginOperation`

`createSale` in `packages/db/src/product.ts` and the correction commands in
`packages/db/src/sales-correction.ts` deliberately do **not** call `beginOperation`. They use
`lockCommandKey` and compose their own authorization. Leave them that way. Two reasons:

1. **Lock order.** `beginOperation` locks the session and membership rows before taking the
   command-key advisory lock. Both sales paths take the command-key advisory lock *first*, then lock
   the session and membership rows `for update`. Moving them onto the shared prologue would invert
   that order relative to the paths that keep it, which is exactly the kind of edit that introduces a
   deadlock.
2. **Two receipt tables, one key space.** Sales share one `(business_id, actor_user_id,
   idempotency_key)` key space across `sale_operation` and `sale_correction`. A key used to post a
   sale must conflict when it is replayed as a correction, and the reverse. Each path therefore reads
   both tables. `findOperationReplay` is single-table by construction and cannot express that.

This divergence is intentional and load-bearing. If it looks like an inconsistency worth tidying up,
read this section first and change the lock order only with concurrency tests that prove the new
order is safe.

## Connections

Local code uses `DATABASE_URL`, bounded by `DATABASE_MAX_CONNECTIONS`. In Cloud Run, total possible
connections are approximately:

```text
maximum Cloud Run instances × per-instance pool maximum
```

Keep that result below the Cloud SQL connection budget with headroom for migrations, operations, and
failover. A high HTTP concurrency setting does not justify one database connection per request.

Set production TLS/network behavior deliberately through `DATABASE_SSL` and the selected Cloud SQL
connection path. Do not disable certificate verification globally.

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

- Back up and confirm recovery objectives before a destructive or high-risk change.
- Run migrations as a separately authorized release step or Cloud Run Job, not in every API instance.
- Prefer expand/migrate/contract: add compatible shape, deploy dual-compatible code, backfill, then
  remove old shape in a later release.
- Take an advisory migration lock or rely on Drizzle's migration ledger so one executor applies a
  migration.
- Verify schema version and critical queries before shifting API traffic.
- Database rollback usually means a forward corrective migration. Do not assume application rollback
  can undo committed data changes.

## Backup and privacy

Use Cloud SQL automated backups and point-in-time recovery appropriate to the environment. Test
restore procedures. Minimize stored provider payloads, restrict access, define retention, and avoid
placing credentials or unnecessary payment/customer data in JSON evidence.

## Official sources

- [PostgreSQL 18 documentation](https://www.postgresql.org/docs/18/)
- [PostgreSQL 18.6 release](https://www.postgresql.org/docs/release/18.6/)
- [Official PostgreSQL container image](https://hub.docker.com/_/postgres)
- [Drizzle PostgreSQL guide](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle migration fundamentals](https://orm.drizzle.team/docs/migrations)
- [Drizzle generate](https://orm.drizzle.team/docs/drizzle-kit-generate)
- [Drizzle migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate)
- [Cloud SQL connection management](https://cloud.google.com/sql/docs/postgres/manage-connections)
- [Cloud SQL backups](https://cloud.google.com/sql/docs/postgres/backup-recovery/backups)
