# ADR 0010: Organization-backed business tenancy

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/auth`, `@pisto/db`, `@pisto/api`
- Supersedes: none
- Research recheck: Better Auth organization model, product role model, or business-deletion policy change

## Context

Every Pisto sale, setting, report, inventory and expense record needs one stable tenant
boundary. The repository already contains the Better Auth organization, member, invitation, session
active-organization, and organization-entitlement schema. Adding a separate workspace-membership
system for the first product slice would create two access models and ambiguous authorization.

Better Auth organizations are an identity and membership boundary, not a suitable store for currency,
time zone, financial rules, or canonical business records. Its active organization is mutable session
context and cannot by itself prove permission for a domain action.

## Decision

- One Pisto business workspace is backed by one Better Auth organization. Pisto contracts and domain
  code call its opaque organization identifier `businessId`.
- The organization owns workspace identity and membership. Its name is the initial business display
  label. A dedicated Pisto business-settings table, keyed by `businessId` and referencing the
  organization, owns operating currency, IANA time zone, and future domain settings. Do not put those
  settings or financial state in Better Auth metadata.
- Onboarding implements authenticated creation/selection of one business workspace and an owner
  membership. [ADR 0014](0014-static-current-operation-permissions.md) owns the current operation
  permissions. Organization tables and provider role strings do not grant financial access by themselves.
- The HTTP boundary blocks raw organization management endpoints. Only the POST active-organization
  selector is exposed there; Pisto-owned onboarding controls business creation. Direct deletion,
  invitations and member administration remain blocked until their product and security flows exist.
- The server resolves the current business and reloads membership for every protected command/query.
  A client/model-supplied ID or session `activeOrganizationId` is only a requested selector; it is not
  authorization evidence.
- Product tables reference the business boundary and use restrictive deletion behavior. Direct
  organization deletion remains blocked. Any future closure flow requires a separately approved
  export, retention and audit policy. An auth route must not cascade-delete a ledger.
- A future multi-user brief may define owner, manager, cashier, and accountant permissions. Map those
  permissions centrally at the application authorization boundary rather than scattering raw role
  string checks through routes, repositories, tools, or UI.

## Consequences

- Current auth, session, membership, and organization-entitlement foundations are reused.
- A user can belong to more than one business later without changing financial table ownership.
- The installed organization client and Pisto-owned onboarding implement workspace creation/selection;
  server table presence alone does not establish additional organization-management features.
- Auth lifecycle and financial retention are deliberately separated. Organization deletion needs
  domain coordination before any closure flow can be enabled.
- Replacing Better Auth later requires a migration of the identity/membership boundary, but domain
  settings and records remain in Pisto-owned tables and contracts.

## Alternatives considered

- **Scope records directly to `userId`:** simpler for one user, but makes later shared businesses and
  existing organization entitlements difficult to reconcile.
- **Create separate business and membership identities now:** provider-neutral, but duplicates an
  installed, schema-backed membership capability without a demonstrated second ownership need.
- **Store all business settings in organization metadata:** avoids a table, but weakens typed schema,
  query, migration, authorization, and audit ownership and couples domain state to auth payloads.
- **Trust the active organization from the session:** rejected because a selector is not fresh
  action-level authorization and cannot replace membership/permission validation.

## Validation and recheck gates

- organization creation/selection and owner membership tests through the exact Better Auth version;
- direct endpoint tests proving creation limits and denial of deletion/invitation/member operations
  that the approved slice does not expose;
- no-session, no-active-business, non-member, wrong-business, removed-member, and role-denial tests;
- cross-tenant database constraints and query/command integration tests;
- concurrent session/business switch and stale membership tests;
- direct organization-delete denial once a business profile or financial record exists; and
- an independent authorization/data-retention review.

## Official sources

- [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization)
- [Better Auth organization access control](https://better-auth.com/docs/plugins/organization#access-control)
