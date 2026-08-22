# ADR 0007: Provider-neutral entitlements

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/billing`, `@pisto/db`, `@pisto/contracts`
- Supersedes: none

## Context

The same capability can be purchased through Polar, Apple, or Google. Provider subscription status
and product IDs are not stable application authorization contracts. Webhooks are delayed, retried,
duplicated, and sometimes out of order; cancellations differ from expiration.

## Decision

Authorize on internal entitlement keys. Normalize trusted provider server notifications into grants
with one subject, `polar | revenuecat | manual` source, source identity, product evidence, status,
and UTC validity interval. RevenueCat is the trusted native notification source; Pisto does not
claim to verify Apple/Google receipts locally. `manual` is reserved for a future audited server-side
override workflow; no creation endpoint or support UI is included.

A subject has a key if any matching grant is active and within its validity interval. Pending,
unknown, inactive, revoked, and expired fail closed. A provider event changes only its source grant.
Persist a unique provider event key and apply ordering logic before effects.

## Consequences

- Features do not depend on vendor product IDs or payloads.
- One source can expire while another continues access.
- Server authorization may lag immediate native UX until webhook/reconciliation; UI handles pending.
- Reconciliation and provider identity mapping are required operational processes.
- Raw payload evidence must be minimized/retained safely while queryable fields stay normalized.

## Alternatives considered

- Trust client purchase status: rejected; client is outside the authorization boundary.
- Check provider live on every request: high latency/availability coupling and rate-limit risk.
- One subscription row overwritten by last provider: loses concurrent valid grants and auditability.

## Validation

- truth-table tests for status/time/multiple-source grants
- duplicate/out-of-order webhook tests
- cancellation versus expiration and refund/revocation tests
- client/API mismatch and reconciliation tests

## Official sources

- [Polar webhook events](https://polar.sh/docs/integrate/webhooks/events)
- [Polar webhook verification](https://polar.sh/docs/integrate/webhooks/delivery)
- [RevenueCat subscription status](https://www.revenuecat.com/docs/customers/customer-info)
- [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks)
- [RevenueCat customer identity](https://www.revenuecat.com/docs/customers/identifying-customers)
