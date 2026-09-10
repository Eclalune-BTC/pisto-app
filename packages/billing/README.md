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

Organization checkout can attach Polar's `referenceId` so webhook projections
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

Run the rollback-only local PostgreSQL regression suite from the repository root:

```sh
bun --env-file=.env run --filter @pisto/billing test:integration
```

Sources reviewed 2026-09-10: [Polar cancellation sequences](https://polar.sh/docs/integrate/webhooks/events),
[RevenueCat event fields and Apple renewal timing](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
and [RevenueCat billing-issue event flows](https://www.revenuecat.com/docs/integrations/webhooks/event-flows).
Recheck these mappings on provider/SDK upgrades. Local fixtures do not certify provider sandbox or
physical-device purchase flows.
