# Neon PostgreSQL deployment

The owner selected Neon as the managed PostgreSQL provider on **2026-09-10**. Pisto keeps the
existing `postgres` driver, Drizzle schema/migrations, and standard PostgreSQL connection URL.
No Neon SDK, Neon Auth, provider data API, or proprietary query path is introduced. Application
code and the container remain usable with another compatible PostgreSQL host.

This guide is configuration and acceptance criteria, not evidence that a Neon project, database,
credential, migration, backup, or production deployment exists.

## Connection and privilege contract

Create a dedicated project/database for the intended environment and confirm the actual PostgreSQL
version against the repository's PostgreSQL 18 validation target. Use a separate development or
staging database; never run destructive integration suites against production data.

Use two database roles and two secret URLs:

| Consumer | Connection | Privileges |
| --- | --- | --- |
| API runtime | Standard TLS PostgreSQL URL, initially direct | Required DML on application/auth/billing tables and sequences; no schema ownership or DDL |
| Migration executor | Direct, non-pooled TLS PostgreSQL URL | Owns application schema objects and applies committed migrations; unavailable to the API |

Create the restricted runtime role with SQL and grant deliberate privileges. Neon Console/API-created
roles can carry `neon_superuser` membership, so a role created there is not automatically an appropriate
application identity. Configure default privileges for future migration-owned tables/sequences and
verify the runtime cannot create/drop schema objects. Keep the auth rate-limit and financial/audit
tables writable as required by the real code.

Provide `DATABASE_URL` privately to each workload, with `DATABASE_SSL=verify-full`. Preserve correct
URL encoding for credentials and confirm certificate/hostname verification in the actual runtime.
Do not print connection strings or place them in `EXPO_PUBLIC_*`, build arguments, PR jobs, or source.
The URL must select the intended branch/database and role; changing only its host is not a complete
migration between providers.

Neon offers direct and transaction-pooled endpoints. The baseline uses direct connections with the
existing application pool to keep semantics predictable. Migrations and exports use direct
connections. Introduce the pooled endpoint for runtime traffic only after exercising the repository's
transactions, prepared statements, timeout, connection-reuse, and auth behavior against it. No
application fallback silently switches between endpoints or providers.

## Capacity and release sequence

1. Establish the environment owner, region, database version, roles, retention/restore window, and
   connection allowance from the selected Neon project and plan.
2. Put runtime and migration URLs in the host's secret store. Pin secret versions where supported.
3. Pass repository/schema checks and an empty-database migration test; test an upgrade from the last
   supported schema/data snapshot.
4. Run the committed migration artifact once with the migration credential, then use the runtime
   credential for readiness, auth, authorized business operations, and permission denial checks.
5. Deploy the portable API image to the chosen container host; export the web app with its real public
   API origin, deploy it independently, and verify the complete browser flow.
6. Record artifact IDs, migration execution, database identity/version, endpoint region, capacity,
   observed latency, recovery evidence, and the rollback owner before routing production traffic.

Budget `maximum API instances × pool size`, overlapping revisions, migration connections, probes,
and administrative reserve together. The optional Cloud Run reference starts at two instances with
five connections each and two for migration. These bounds require validation against the project's
capacity and measured workload. Verify cold-start/wake-up latency, connection exhaustion, sustained
query latency, and recovery after interruption. `/ready` has a bounded response deadline; it is not
a load test or a guarantee about database availability.

## Recovery and exit

Confirm the actual plan's restore window and protection settings. Perform a restore drill into a
separate environment and verify auth, memberships, migrations, financial records, idempotency, and
audit continuity. Record the achieved recovery point and recovery time; available platform features
alone do not establish an RPO/RTO.

Keep an independently restorable PostgreSQL export when the retention plan requires it. Use standard
`pg_dump`/`pg_restore` over a direct endpoint with compatible PostgreSQL tooling. Moving providers
requires exporting/restoring schema and data, recreating roles and grants without provider-managed
roles, updating secret references, verifying database and auth behavior, and a controlled traffic
cutover. Neon branches are useful operational features but are not required by Pisto's product or CI.

## Source review

Reviewed on **2026-09-10**. Recheck before changing connection mode, database version, privilege setup,
hosting region, or plan-dependent retention/capacity:

- [Neon connection pooling and direct migration connections](https://neon.com/docs/connect/connection-pooling)
- [Neon PostgreSQL compatibility and role privileges](https://neon.com/docs/reference/compatibility)
- [Neon connection security](https://neon.com/docs/security/security-overview)
- [Export to PostgreSQL-compatible destinations](https://github.com/neondatabase/website/blob/main/content/docs/guides/export-neon-postgres-compatible.md)
- [PostgreSQL backup and restore](https://www.postgresql.org/docs/18/backup.html)
- [Cloud Run reference](cloud-deployment.md)
