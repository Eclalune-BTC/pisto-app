# ADR 0006: Split web and native billing channels

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/billing`, `@pisto/app`
- Supersedes: none
- Policy researched: 2026-08-22; recheck every mobile submission

## Context

Pisto sells digital application access on web, iOS, and Android. Web checkout, Apple in-app purchase,
and Google Play Billing have different transaction systems and store policy. A shared visual paywall
must not conceal an invalid shared payment mechanism.

## Decision

Use Polar only for authenticated browser checkout/portal. The web app posts an allowlisted product
slug to the API and opens the server-returned URL; no public direct Polar checkout variable exists.

Use Apple IAP and Google Play Billing through RevenueCat for native digital purchases. Native builds
never invoke the Polar checkout endpoint. RevenueCat normalizes native store status but does not
convert web purchases into native transactions.

Default conservatively to native store billing. Any regional alternative-billing/external-link path
requires current policy/legal review, program enrollment evidence, scoped flags, and a superseding or
amending ADR.

## Consequences

- Product IDs/prices/configuration exist separately per channel.
- Users manage subscriptions where purchased; Restore Purchases is required on native.
- Provider dashboards and webhooks are release-critical configuration.
- The app needs a platform billing adapter and physical-device store sandbox tests.
- Store policy drift is a recurring release obligation.

## Alternatives considered

- Polar link on every platform: rejected; bypasses server binding and native billing defaults/policy.
- RevenueCat Billing for web: technically possible, but Polar is the selected web merchant path.
- Direct StoreKit/Play integrations: possible, but duplicates receipt/status infrastructure that
  RevenueCat supplies.

## Validation

- no native bundle path opens Polar checkout for digital access
- Polar sandbox checkout/webhook/portal cases
- RevenueCat plus Apple/Google sandbox purchase/restore lifecycle
- current Apple/Google policy audit attached to store release

## Official sources

- [Apple App Review Guidelines 3.1](https://developer.apple.com/app-store/review/guidelines/#business)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Google Play US update](https://support.google.com/googleplay/android-developer/answer/15582165)
- [Polar Checkout API](https://polar.sh/docs/features/checkout/session)
- [RevenueCat React Native SDK](https://www.revenuecat.com/docs/getting-started/installation/reactnative)
