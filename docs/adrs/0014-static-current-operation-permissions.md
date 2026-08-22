# ADR 0014: Static permissions for current business and sales operations

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/contracts`, `@pisto/db`, `@pisto/api`, `@pisto/auth`
- Supersedes: the owner-only product-authorization clauses in ADR 0010 and ADR 0012
- Research recheck: invitation delivery, role-management UI, a new business operation, custom roles,
  or a Better Auth organization-role storage change

## Context

Pisto's first persisted sales increment checked the raw `owner` membership value in several queries.
That was safe for the first owner-only flow but duplicated policy and made adding another current
operator either inconsistent or overly permissive. The existing Better Auth organization member row
already stores the provider's static `owner`, `admin`, and `member` role vocabulary. A second role
table or dynamic-role system would duplicate that identity boundary without an approved management
workflow.

Better Auth's organization access control protects organization-management resources. Pisto's sales
authorization is a separate application policy: an organization role never grants access to
financial records merely because the provider recognizes it.

## Decision

- Pisto recognizes only the exact stored roles `owner`, `admin`, and `member`. Unknown, custom,
  comma-composed, malformed, or missing role values fail closed. Multiple-role support is not
  inferred from Better Auth capability.
- `@pisto/db` owns one static current-operation policy and applies it inside the tenant-scoped
  repository queries and transactions. Routes and clients do not compare raw role strings.
- The current permission matrix is:

| Permission | Owner | Admin | Member |
| --- | --- | --- | --- |
| `business:configure` | Yes | No | No |
| `business:read` | Yes | Yes | Yes |
| `sales:create` | Yes | Yes | Yes |
| `sales:read` | Yes | Yes | Yes |
| `sales:summary:read` | Yes | Yes | Yes |
| `catalog:read` | Yes | Yes | Yes |
| `catalog:manage` | Yes | Yes | No |
| `inventory:read` | Yes | Yes | Yes |
| `inventory:manage` | Yes | Yes | No |
| `expenses:read` / `expenses:manage` | Yes | Yes | No |
| `cash:read` / `cash:manage` | Yes | Yes | No |
| `customers:read` / `customers:manage` | Yes | Yes | No |
| `receivables:read` / `receivables:manage` | Yes | Yes | No |
| `reports:read` | Yes | Yes | No |
| `assistant:use` | Yes | Yes | Yes |

- Business bootstrap, sole-owner legacy adoption, and replay of create-once currency/time-zone
  configuration remain owner-only. Owner and admin can manage the accepted operating-core modules;
  member keeps the sales workflow, can read catalog/stock, and can use the assistant only through
  tools independently authorized by their underlying permission.
- Business responses expose the server-resolved exact role and effective permission list. This lets
  a client present truthful capability state, but the client response is not authorization evidence.
- Every financial command/query still resolves the active business from a fresh session and reloads
  exact membership in the same transaction or SQL statement that applies the operation. A role
  change or membership removal therefore takes effect without trusting cached client/session roles.
- Cross-business sale lookup remains undisclosed as `NOT_FOUND`; a recognized identity with an
  unsupported role in its selected business receives `FORBIDDEN`.
- Raw Better Auth organization creation, deletion, invitation, member, role, and team routes remain
  blocked. This ADR does not implement invitations, role administration, custom roles, teams,
  cashier/accountant semantics, or UI for managing people.

## Consequences

- The existing `member.role` column is sufficient, so this change adds no dependency, table, or
  migration.
- Owner, admin, and member can all complete the current manual sale and previous-month summary flow;
  only an owner can establish the business's immutable initial settings. The accepted operating-core
  permissions are available for implementation without inferring a custom-role system.
- Product permissions have one explicit source instead of raw role checks distributed across SQL.
- A future capability adds its named permission only after its actor and denial behavior are
  approved. A future cashier/accountant model or multiple simultaneous roles requires a new role
  matrix, migration/compatibility decision if needed, and denial/cross-tenant tests.
- Member invitation and promotion remain unusable through public routes, so this is an authorization
  foundation rather than a completed team-management product.

## Alternatives considered

- **Keep owner-only checks:** safe but prevents the requested current-operation role foundation and
  continues duplicated raw-role comparisons.
- **Use Better Auth `hasPermission` for product records:** useful for organization plugin endpoints,
  but it would split financial authorization from the atomic PostgreSQL operation and make provider
  configuration the owner of Pisto domain policy.
- **Enable dynamic access control:** rejected because it adds a role table and management surface
  without an approved custom-role job. Better Auth documents that this requires an additional schema.
- **Add manager/cashier/accountant now:** rejected because their exact data visibility, correction,
  export, and administration rights are not approved.

## Validation

- Contract tests reject unknown role and permission strings and require resolved access on each
  business response.
- Pure policy tests cover every role, permission, and unknown/composite-role denial.
- PostgreSQL integration tests cover owner/admin/member sales, summary reads, exposed effective
  access, unknown-role denial, expired session, idempotency, and cross-tenant nondisclosure.
- Existing API guards continue to deny raw organization/member/role endpoints.

## Official sources

- [Better Auth organization plugin and access control](https://better-auth.com/docs/plugins/organization)
  (reviewed 2026-08-22; recheck on the triggers above)
