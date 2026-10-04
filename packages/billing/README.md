# Billing package

This package keeps the application's entitlement records provider-neutral while
integrating Polar for web checkout and RevenueCat webhooks for native purchase
signals.

Polar webhook signatures are verified by `@polar-sh/better-auth`. Exact payload
fingerprints are stored transactionally before projections, so retried payloads
do not apply twice. RevenueCat uses its event ID as the idempotency key and
requires the configured Authorization value. If
`REVENUECAT_WEBHOOK_SIGNING_SECRET` is set, the raw request body must also pass
RevenueCat's timestamped HMAC verification.

RevenueCat webhook trust is not App Store or Play Store receipt verification.
The native client must identify the purchaser with the Better Auth user ID.
Anonymous IDs are not provisioned. Transfer and product-change sequences can
require reconciliation against RevenueCat's canonical customer state; this
delta webhook seam deliberately does not claim complete lifecycle
reconciliation.

Organization checkout passes adapter `reference_id`, stored as `metadata.referenceId`, so webhook projections
grant the entitlement to that organization. The Better Auth customer portal is
still scoped to the Polar customer who made the purchase. Other organization
members are not given that purchaser's portal; organization-wide billing
administration requires a separate role-checked design.

The API does not expose Polar's generic checkout or customer endpoints through
the Better Auth catch-all. Clients must use the allowlisted, scope-checked
`/v1/billing/*` routes. The Polar webhook remains mounted under Better Auth so
the adapter can verify its signature before any event is projected.

All integrations are disabled by default. Enabling one with incomplete
configuration fails application startup rather than silently accepting an
unverified billing state.

Polar auth lifecycle customer synchronization is disabled; checkout and portal bind the authenticated
immutable user ID. Provider calls have a 10-second timeout and no automatic retries. See the
[identity and failure contract](../../docs/billing-entitlements.md#web-purchase-flow) and the
[SDK upgrade and sandbox gate](../../docs/versioning-upgrades.md#polar-and-revenuecat) before enabling billing.

Lifecycle projections compare timestamps through Drizzle's column-aware operators so Postgres.js
receives encoded timestamp parameters. Polar's subscription row serializes changes across entitlement
keys; changed or unmapped products retire the previous grants, and stale events cannot create an old
key. A Polar `canceled` provider status is revoked even if its old period ends in the future. Scheduled
cancellation retains provider status `active`.

RevenueCat scheduled pauses retain the verified paid interval. Billing issues retain an explicit
store grace deadline; their `CANCELLATION` / `BILLING_ERROR` companions are recorded without projecting
access, so either arrival order preserves grace. `EXPIRATION` still removes access. An early Apple
renewal extends a continuous, already-active interval without moving its start into the future.
This does not bridge a gap between noncontiguous purchases.

Customer-state reads use the scoped SDK boundary directly because the installed Better Auth Polar
organization-list handler prints raw SDK failures outside its configured logger. SDK errors become
the stable API `BILLING_UNAVAILABLE` response without retaining their private payload.
The client uses SDK 1.0.2 / adapter 2.0.1 and pins API `2026-10`. Provider payloads use snake_case;
public envelopes and database column names are unchanged. Opaque customer state receives bounded
structural validation; entitlement projections retain strict required-field validation. Signed unknown
Polar event types are acknowledged by the adapter without a receipt or projection.

Run the rollback-only PostgreSQL regression suite from the repository root with `DATABASE_URL`
explicitly set to a verified disposable local test database. The localhost guard does not establish
isolation; do not use the owner's active business database or rely on rollback as that boundary.

```sh
bun run --filter @pisto/billing test:integration
```

Sources reviewed 2026-09-10: [Polar cancellation sequences](https://polar.sh/docs/integrate/webhooks/events),
[RevenueCat event fields and Apple renewal timing](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
and [RevenueCat billing-issue event flows](https://www.revenuecat.com/docs/integrations/webhooks/event-flows).
Recheck these mappings on provider/SDK upgrades. Local fixtures do not certify provider sandbox or
physical-device purchase flows.
