# ADR 0004: PostgreSQL and Drizzle migrations

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/db`
- Supersedes: none

## Context

Authentication, organizations, webhook deduplication, subscriptions, and entitlement authorization
need transactional updates, constraints, indexed queries, and durable migration history. Any shared environment
requires controlled schema evolution and verified database operations; no host is selected.

## Decision

Use PostgreSQL 18 and Drizzle ORM. TypeScript schema in `@pisto/db` is the code source; generated SQL
migrations are reviewed, committed, and applied by one separately authorized migration step. Use `db:push` only on disposable local databases. The API never migrates on startup.

Use PostgreSQL constraints for subject/uniqueness/foreign-key invariants, short transactions for
state projection, and a bounded connection pool sized against actual database and API concurrency.

## Consequences

- Strong relational invariants and transactions support auth/billing correctness.
- Engineers must review SQL and plan expand/migrate/contract compatibility.
- Application rollback does not automatically roll back data; forward recovery is required.
- Database connection budgeting remains an explicit constraint for any future shared deployment.

## Alternatives considered

- SQLite: excellent local/edge fit, insufficient parity for the selected PostgreSQL transaction and concurrency model.
- Schema push in production: fast, but bypasses reviewed/replayable change artifacts.
- Migrate at every API startup: races under autoscaling and expands runtime privileges.

## Validation

- migration on empty PostgreSQL 18
- upgrade from previous realistic data snapshot
- constraint/repository transaction tests
- actual connection budget and isolated backup/restore validation

## Official sources

- [PostgreSQL 18](https://www.postgresql.org/docs/18/)
- [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [Drizzle migrations](https://orm.drizzle.team/docs/migrations)
