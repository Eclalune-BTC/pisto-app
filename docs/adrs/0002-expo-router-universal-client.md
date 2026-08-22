# ADR 0002: Expo Router universal client

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/app`
- Supersedes: none

## Context

Pisto needs Android, iOS, and web experiences with shared product flows but platform-specific
navigation, storage, accessibility, and purchase behavior. Maintaining independent clients would
duplicate early product work and make contract drift likely.

## Decision

Use stable Expo SDK 57 with its supported React Native/React matrix and Expo Router file-based routes.
Share screens/domain UI where interaction matches, use responsive web and native navigation shells,
and isolate true platform differences behind platform files/adapters.

Use Expo development builds for native modules and EAS-compatible build/submission workflows. Treat
all `EXPO_PUBLIC_*` values as public. The client performs UX gating; the API performs authorization.

## Consequences

- One route model supports deep links and web/native navigation.
- SDK upgrades must keep the complete Expo compatibility matrix together.
- RevenueCat/native modules require development/store builds, not Expo Go-only validation.
- Platform billing behavior must be adapter-driven rather than hidden in shared buttons.

## Alternatives considered

- Three independent clients: maximum platform control with unacceptable duplication now.
- React Native without Expo: viable but adds native configuration/release maintenance.
- WebView wrapper: weak native UX, security, accessibility, and store-billing fit.

## Validation

- Expo Doctor and `@pisto/app` typecheck/tests/build
- Android, iOS, and web route/deep-link checks
- accessibility and safe-area checks
- development build after native dependency/config changes

## Official sources

- [Expo SDK compatibility matrix](https://docs.expo.dev/versions/latest/)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Expo Router SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
