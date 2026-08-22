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
