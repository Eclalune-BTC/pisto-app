# ADR 0004: PostgreSQL and Drizzle migrations

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/db`
- Supersedes: none

## Context

Authentication, organizations, webhook deduplication, subscriptions, and entitlement authorization
need transactional updates, constraints, indexed queries, and durable migration history. Production
requires a managed relational database and controlled schema evolution.

## Decision

Use PostgreSQL 18 and Drizzle ORM. TypeScript schema in `@pisto/db` is the code source; generated SQL
migrations are reviewed, committed, and applied by one separately authorized release step/Cloud Run
Job. Use `db:push` only on disposable local databases. The API never migrates on startup.

Use PostgreSQL constraints for subject/uniqueness/foreign-key invariants, short transactions for
state projection, and a bounded connection pool sized against Cloud Run instance limits.

## Consequences

- Strong relational invariants and transactions support auth/billing correctness.
- Engineers must review SQL and plan expand/migrate/contract compatibility.
- Application rollback does not automatically roll back data; forward recovery is required.
- Cloud SQL connection budgeting becomes an explicit scaling constraint.

## Alternatives considered

- SQLite: excellent local/edge fit, insufficient parity for the selected managed production model.
- Schema push in production: fast, but bypasses reviewed/replayable change artifacts.
- Migrate at every API startup: races under autoscaling and expands runtime privileges.

## Validation

- migration on empty PostgreSQL 18
- upgrade from previous realistic data snapshot
- constraint/repository transaction tests
- Cloud SQL pool and backup/restore review

## Official sources

- [PostgreSQL 18](https://www.postgresql.org/docs/18/)
- [Cloud SQL supported PostgreSQL versions](https://cloud.google.com/sql/docs/postgres/db-versions)
- [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
- [Cloud SQL connection management](https://cloud.google.com/sql/docs/postgres/manage-connections)
