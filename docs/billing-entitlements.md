# Billing and entitlements

This document is normative. A platform-specific shortcut must not bypass it.

## Billing channels are intentionally separate

| User surface | Purchase channel | Integration | Default rule |
| --- | --- | --- | --- |
| Browser/web build | Polar hosted web checkout and portal | Server-side Polar SDK / Better Auth plugin | Allowed for web purchases |
| Native iOS build | Apple in-app purchase | RevenueCat React Native SDK wrapping StoreKit | Use native store UI for digital access |
| Native Android build distributed by Google Play | Google Play Billing | RevenueCat React Native SDK wrapping Play Billing | Use native store UI for digital access |

Polar is not the native in-app purchase implementation. RevenueCat does not turn a Polar checkout
into an Apple or Google store transaction. Product setup, prices, purchase UI, receipts, refunds, and
subscription management remain distinct by channel even when all channels grant the same internal
entitlement.

The conservative application default is therefore:

```text
Platform.OS === "web" -> Polar web purchase
Platform.OS === "ios" -> Apple IAP through RevenueCat
Platform.OS === "android" -> Google Play Billing through RevenueCat
```

The implemented Polar projector handles `subscription.*` lifecycle events only. It does not grant
access from Polar one-time order/product events. Do not sell or map a one-time Polar product to an
entitlement until order-event verification, persistence, refund/revocation behavior, idempotency,
and tests are implemented and documented.

Do not expose a direct Polar checkout environment URL or open a server-returned Polar URL from a
native build to unlock digital features. If native store billing is not fully configured, show current access and a restore
or support path; do not silently substitute web checkout.

## Store policy and regional exceptions

Policy is jurisdiction-, storefront-, program-, and date-sensitive. This is an engineering default,
not legal advice.

As researched on **2026-08-22**:

- Apple App Review Guideline 3.1.1 says unlocking app features or digital content uses in-app
  purchase. Guideline 3.1.1(a) describes external-purchase-link rules: United States storefront apps
  can include external purchase calls to action without that entitlement, while specified other
  storefronts/programs use entitlements and additional terms.
- Google Play's Payments policy requires Play billing for in-app digital access and prohibits steering
  except where its listed exceptions/programs apply. Sections 8 and 9 cover eligible alternative
  billing and external-offers programs.
- Google's separate US policy update records injunction-related changes and current US programs. It
  includes a June 22, 2026 notice, July 22 program/distribution changes, and an October 1, 2026 start
  for specified reporting and service-fee obligations. Those facts can change while this repository
  does not.

Pisto does not activate an exception merely because it exists. Before any non-default native payment
path, product/legal owners must document targeted storefronts, program enrollment, disclosures,
reporting/fee obligations, app behavior, and review evidence in a new ADR. Feature flags must default
off outside the approved scope. Re-run the policy audit in
[Versioning and upgrades](versioning-upgrades.md#repeatable-upgrade-audit) for every store release.

Official policy pages:

- [Apple App Review Guidelines, section 3.1](https://developer.apple.com/app-store/review/guidelines/#business)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Google Play US policy update](https://support.google.com/googleplay/android-developer/answer/15582165)

## Provider-neutral entitlement model

Products describe what can be bought. Entitlements describe what an authenticated subject may use.
Application code gates features on an internal key such as `pro`, never on a Polar/Apple/Google
product identifier.

Each persisted entitlement grant has:

| Field | Meaning |
| --- | --- |
| `key` | Stable internal capability, for example `pro` |
| subject | Exactly one `userId` or `organizationId` |
| `source` | Normalized authority: `polar`, `revenuecat`, or reserved `manual` |
| `sourceId` | Provider grant/subscription identity used for idempotent updates |
| `productId` | Provider product evidence; not an authorization key |
| `status` | `active`, `inactive`, `pending`, `revoked`, `expired`, or `unknown` |
| `sourceEventAt` | Provider effective timestamp used to reject stale regressions |
| `validFrom`, `validUntil` | Optional UTC validity interval; null end can represent non-expiring access |
| `metadata` | Bounded provider/evaluation context, not the sole authorization data |

The `polar` and `revenuecat` values name the system whose authenticated server notification the
backend trusts. A `revenuecat` row can originate from Apple or Google; store identity can be retained
as metadata. The API does not claim to verify Apple/Google receipts itself.

`manual` is a reserved provider-neutral grant source accepted by the contract and resolver. This
repository has no admin endpoint, support UI, or audited command that creates manual grants. Do not
write one directly in production; first design a least-privilege, reasoned, expiring, audited
override workflow and its revocation/reconciliation behavior.

### Resolution rule

A grant satisfies a requested key only when:

1. subject and key match;
2. `status` is `active`;
3. `validFrom` is absent or not in the future;
4. `validUntil` is absent or later than evaluation time.

If any grant satisfies the key, the subject has access. `pending`, `unknown`, `inactive`, `revoked`,
and `expired` fail closed. A Polar revocation changes only the matching Polar grant; it cannot revoke
a separate valid RevenueCat grant. All comparisons use a server clock.

Provider grace/billing-retry semantics must be normalized deliberately. If RevenueCat reports an
entitlement active during a store grace period, the normalized grant can remain active until its
reported expiration. Do not infer grace solely from `willRenew=false`: cancellation often means the
subscription remains valid through the paid period.

### Source of truth by use

| Use | Source |
| --- | --- |
| Immediate native paywall feedback | RevenueCat `CustomerInfo` active entitlement |
| Server API authorization | Persisted normalized entitlement projection |
| Web purchase/customer management | Polar server API and signed webhook projection |
| Audit/reconciliation | Provider event evidence plus current provider server state; operational seam, not an included scheduler |

The native SDK result is never accepted as an API authorization claim. Server state is updated by an
authenticated RevenueCat webhook or explicit server-to-server reconciliation. The webhook path is
included; a scheduled reconciliation worker is not.

## Identity mapping

- Polar customers use the Pisto user ID as `external_customer_id` where the integration supports it.
- RevenueCat uses a stable, non-guessable custom App User ID associated with the authenticated Pisto
  user. Do not use email, advertising IDs, or one hard-coded value.
- Configure RevenueCat only after the Pisto identity is known when anonymous purchase merging is not
  an intentional product behavior.
- On account switch, call the documented RevenueCat identity method and clear prior cached state.
- Include a user-visible support identifier in Settings without exposing credentials.
- A user manages a subscription on the channel where it was purchased.

RevenueCat restore/transfer behavior is a product and fraud-control decision. Configure it, test
cross-account cases, and record it before release.

## Product mapping

Maintain one reviewed mapping per environment:

```text
internal entitlement key
  |-- Polar sandbox/production product IDs and web slug
  `-- RevenueCat entitlement
      |-- App Store product ID
      `-- Google Play subscription/base plan ID
```

Sandbox and production identifiers are never mixed. `POLAR_SERVER` has no default: when
`BILLING_ENABLED=true`, startup fails unless it is exactly `sandbox` or `production`, because Polar
access tokens are environment-specific and a guessed server only fails later at checkout. The browser receives only catalog slugs and
display data; the API maps a slug through `POLAR_PRODUCTS_JSON`. Native offerings and localized price
strings come from RevenueCat/store configuration. Never accept amount, currency, duration, price, or
an arbitrary provider product ID from the client.

## Web purchase flow

1. Web client fetches the public, allowlisted `/v1/billing/catalog` display catalog.
2. Client posts one allowlisted slug to `/v1/billing/checkout`.
3. Server binds the checkout to the authenticated user's immutable ID and returns a Polar URL.
4. Browser navigates to Polar. Success return is UX only, not proof of payment.
5. Polar sends a signed webhook. Server verifies the exact body and headers before trust.
6. One transaction records the unique provider event and updates projections/entitlements.
7. The return screen checks `/v1/billing/entitlements` once on entry and offers an explicit refresh
   action while access is not active; it does not poll automatically. A client that also needs
   scoped Polar customer state may request `/v1/billing/state`.

Automatic customer synchronization on auth sign-up, update and deletion is disabled. Customer
creation/reuse belongs to checkout's authenticated `external_customer_id`; do not relink a
pre-existing buyer by matching an unverified email. Before the first checkout
has established a customer, provider state/portal reads may return unavailable. Preserve that failure
instead of inventing empty customer state. Existing purchaser IDs remain the portal identity.

The Polar core client pins API `2026-10` and sets `timeout: 10` in seconds. SDK 1.0.2 performs one
outgoing request with no automatic retries. A timeout
returns the existing opaque provider-unavailable error; it does not prove that an external checkout
mutation was rolled back. These boundaries were checked against adapter 2.0.1 and SDK 1.0.2 on
2026-10-03, including real hooks/endpoints with intercepted HTTP. Use the
[adapter documentation](https://polar.sh/docs/integrate/sdk/adapters/better-auth), published package
source and [upgrade contract](versioning-upgrades.md#polar-and-revenuecat). Real sandbox purchase
acceptance remains required after any adapter/SDK or customer-identity change.

For an active organization scope, checkout may send that organization ID to Polar as
adapter input `reference_id`, stored in `metadata.referenceId`, allowing the verified webhook
projection to grant an organization entitlement. The
Polar customer portal is still purchaser/customer-scoped. Other organization members do not inherit
the purchaser's portal access; an organization-wide billing-admin workflow would be a separate
feature and authorization design. `POST /v1/billing/portal` accepts an empty body.

The `customerState` field is an opaque provider result, now using API `2026-10` snake_case fields.
No application UI inspects its internal properties. User state retains a direct object; organization
state retains `{ result: { items, pagination } }` and fetches only the first page. Local validation
requires the customer ID and subscription/benefit/meter collections, or list items and nonnegative
pagination counts. It does not recreate the provider's complete model schema. Missing required results
fail as unavailable; genuine empty collections and arbitrary metadata keys are preserved. Provider
state never replaces PostgreSQL entitlement authorization.

Share a persistent Polar Checkout Link or a newly created Checkout Session URL according to the
chosen integration; never persist/reuse an expiring session URL as a permanent product link.

## Native purchase and restore flow

This is the required target flow after the native integration release gate passes. In the baseline,
the provider-neutral native adapter is disabled and the RevenueCat React Native SDK is not installed.

1. Native client configures RevenueCat with the platform's public SDK key and stable App User ID.
2. It fetches offerings, presents the store-derived price, and invokes the native purchase method.
3. After completion it checks `CustomerInfo.entitlements.active[<key>]` and refreshes API state.
4. RevenueCat posts an authenticated webhook to the API; the API deduplicates and normalizes it.
5. Restore Purchases is always visible in the billing/settings UI and triggers RevenueCat's restore
   method, followed by both SDK and API refresh.

Use an Expo development build and store sandbox accounts. RevenueCat/native purchases are not
accepted based only on Expo Go or a web preview.

## Webhook trust and ordering

### Polar

- Validate webhook signatures with the official SDK and the unchanged dashboard `POLAR_WEBHOOK_SECRET`.
  SDK 1.0.2 supports both legacy whole-secret UTF-8 and Standard Webhooks base64-decoded keys.
- Use the exact raw payload/headers expected by the verifier.
- Deduplicate by `(provider, event key)` before changing state. Both providers share one receipt
  and grant-upsert core (`packages/billing/src/projection.ts`); a grant is keyed by
  `(source, sourceId, key)` and an update older than the stored `sourceEventAt` is ignored.
- The projection consumes the SDK's API `2026-10` snake_case subscription shape. Required event time,
  identifiers, status, cancellation flag and current-period bounds are validated before persistence.
  Missing fields do not use receipt time, another timestamp, camelCase aliases or an empty object.
  Fingerprints retain the original event payload; optional customer linkage remains nullable.
- An unlinked subject is recorded without a grant rather than rejected. Polar retries a failed
  delivery up to 10 times and disables the endpoint after 10 consecutive non-2xx responses
  ([delivery](https://polar.sh/docs/integrate/webhooks/delivery), checked 2026-10-04), so a
  permanent identity miss must not block every later event. A customer without a known
  `external_id` user projects no personal grant. A `metadata.referenceId` that names no organization
  projects no grant at all; it never falls back to a personal grant for the purchaser. The next
  subscription event carries complete state and re-projects once the subject exists.
- Signature verification and event-type recognition do not validate required projection fields in
  this SDK. Keep the application schema. The adapter acknowledges signed unknown event types without
  calling the projector or recording a receipt; known malformed subscription payloads fail and can retry.

### RevenueCat

- Configure a high-entropy Authorization header value in RevenueCat and compare it server-side using
  a timing-safe mechanism. When HMAC signing is enabled, verify
  `X-RevenueCat-Webhook-Signature` against the exact raw body and enforce the configured timestamp
  tolerance before parsing or trusting the event.
- Use RevenueCat's unique event identity for deduplication.
- A projectable event whose App User ID matches no Pisto user returns `409` before the receipt is
  committed. RevenueCat treats any non-200 as failure and retries 5 times (5, 10, 20, 40 and 80
  minutes) before stopping ([webhooks](https://www.revenuecat.com/docs/integrations/webhooks),
  checked 2026-10-04), which covers a purchase that reaches the webhook before account linkage.
- Projected grants require a real original/transaction ID, product, purchase time and an explicitly
  present expiration field. Missing or invalid dates never become lifetime access. Explicit null
  expiration remains supported for non-renewing purchases and their cancellation/refund events.
  Unsupported and unmapped events remain non-projecting; malformed required projection data rejects
  and rolls back its receipt so a corrected delivery can retry.
- Treat the notification as RevenueCat-trusted subscription information, not as locally verified
  Apple/Google receipt cryptography.

### Both

Polar payloads were checked against SDK 1.0.2 and the [signature guide](https://polar.sh/docs/integrate/webhooks/delivery)
on 2026-10-03. RevenueCat [event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)
were reviewed 2026-09-26. Recheck on provider/SDK changes. Local fixtures do not establish provider-sandbox or
store acceptance, including temporary-grant payload compatibility.

- Production and sandbox endpoints/configuration are separated.
- Expect retries, duplicates, delays, and out-of-order events.
- Compare provider effective time/version and do not let an older event regress a newer projection.
- Project supported events only after durable receipt. Signed unknown Polar event types follow the
  explicit non-projecting acknowledgement above. Introduce a bounded background-work adapter only
  after a real asynchronous job and its idempotency, authorization and failure rules are approved.
- Retain the minimum bounded payload evidence needed for support/audit and redact logs.
- A future reconciliation job should compare active local grants with provider server state; no
  scheduler or queue is included in this baseline.

## Failure behavior

| Condition | Result |
| --- | --- |
| Billing disabled/unconfigured | Explicit disabled state; no fake URLs or products |
| Invalid webhook signature/auth | Reject; do not persist as trusted or mutate entitlements |
| Duplicate event | Acknowledge safely; no duplicate side effect |
| Out-of-order older event | Record/observe as needed; do not regress current grant |
| Purchase canceled | No internal error; retain previous entitlement state |
| Provider timeout | Return retryable unavailable response; do not assume purchase failed/succeeded |
| Cancellation at period end | Keep grant active until verified expiration |
| Refund/revocation | Revoke the matching provider grant after verified event |
| Unknown provider state | Fail closed for new authorization; flag for reconciliation once that operational seam exists |

## Native billing release gate

Do not enable native purchase controls until all are true:

- Apple and Google products, subscription groups/base plans, agreements, tax, and sandbox testers are
  configured.
- RevenueCat apps, products, offerings, entitlement mapping, public SDK keys, server notifications,
  App User ID behavior, and restore policy are configured separately for test and production.
- The SDK is installed in an Expo development build and tested on physical iOS and Android devices.
- Purchase, renewal, cancel-at-period-end, grace/billing issue, expiration, refund, restore,
  reinstall, multi-device, and account-switch scenarios pass.
- Backend RevenueCat webhook authentication, deduplication, ordering, and reconciliation pass.
- Store listing disclosures, review notes, privacy declarations, and current regional payment-policy
  review are complete.

## Official integration sources

- [Polar Checkout Links](https://polar.sh/docs/features/checkout/links)
- [Polar Checkout API](https://polar.sh/docs/features/checkout/session)
- [Polar webhook setup](https://polar.sh/docs/integrate/webhooks/endpoints)
- [Polar webhook validation and delivery](https://polar.sh/docs/integrate/webhooks/delivery)
- [Better Auth Polar plugin](https://better-auth.com/docs/plugins/polar)
- [RevenueCat React Native SDK](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
- [RevenueCat Expo integration](https://www.revenuecat.com/docs/getting-started/installation/expo)
- [RevenueCat customer identity](https://www.revenuecat.com/docs/customers/identifying-customers)
- [RevenueCat subscription status](https://www.revenuecat.com/docs/customers/customer-info)
- [RevenueCat restoring purchases](https://www.revenuecat.com/docs/getting-started/restoring-purchases)
- [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks)
