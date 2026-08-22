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
- The public entitlement contract accepts `polar`, `revenuecat`, and reserved `manual` sources, but
  no supported manual-grant write workflow is implemented.

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
