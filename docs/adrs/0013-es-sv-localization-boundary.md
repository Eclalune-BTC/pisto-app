# ADR 0013: Typed `es-SV` localization boundary

- Status: Accepted
- Date: 2026-08-22
- Owners: `@pisto/app`
- Supersedes: the deferred-localization guidance in the product and frontend guides
- Research recheck: second supported locale, in-app language override, RTL, localized native metadata, or server-localized billing catalog

## Context

The universal Expo client mixed hard-coded Spanish product copy with English billing copy, English
adapter messages, and an exported web document labeled `lang="en"`. Keeping phrases inside screens
also made provider and validation layers own presentation language. Pisto needs one truthful Spanish
experience now and a clean expansion path without pretending that a second locale already exists.

## Decision

- `es-SV` is the only supported product locale for this increment. Unsupported device preferences
  resolve explicitly to that product default.
- `expo-localization` reads the system/app language on web, iOS, and Android. The Expo config plugin
  declares `es-SV`; no in-app selector or persisted override exists until a second locale is approved.
- `i18next` and `react-i18next` own one resource-derived TypeScript catalog with nested English
  semantic keys. One namespace and one resource file are sufficient at the current scale.
- Visible text and accessibility labels come from the catalog. Code identifiers, domain enums,
  contracts, logs, tests, and internal exception messages remain English.
- Domain and adapter layers return stable English reason codes. They never return translated copy or
  arbitrary provider messages for display.
- Locale controls presentation only. Business currency, currency exponent, IANA time zone, canonical
  local date/time snapshots, and money values remain server-owned.
- Money and date formatters require an explicit locale. Canonical `YYYY-MM-DD`, `HH:MM`, ISO currency,
  and IANA zone values remain unchanged when the display locale changes.
- Static exported web HTML declares `lang="es-SV"` for correct accessibility and indexing.

## Consequences

- A second language requires a complete reviewed catalog, updated supported locales, rendered UI
  checks, and an explicit product decision about account-versus-device preference.
- Missing translation keys do not silently fall back to another language. The one supported catalog
  must be complete before build and release.
- Remote billing plan copy remains an application-owned configuration concern. Before paid plans are
  enabled, stable product slugs need an approved localized display-copy contract.
- Translation management, extraction/codegen, lazy catalog loading, RTL, localized permission
  metadata, and server `Accept-Language` handling remain deferred.

## Alternatives considered

- **Keep copy in components:** rejected because the current app already produced mixed-language UI
  and leaked presentation strings from logic layers.
- **Use `i18n-js`:** Expo documents it as a simple option, but resource-derived TypeScript keys,
  React updates, interpolation, and plurals would require an additional custom facade.
- **Ship Spanish and English immediately:** rejected because no English product-copy brief or
  acceptance review exists. Internationalization does not imply an unreviewed translation.
- **Persist a language preference now:** rejected because one supported locale makes the setting
  meaningless and creates an unnecessary account/device synchronization contract.

## Validation

- Tests cover locale resolution, interpolation, plurals, exact large-money formatting, and reason-to-copy boundaries.
- TypeScript derives valid translation keys from the `es-SV` resource.
- Expo web export, compact/wide browser review, and generated HTML language inspection are required.

## Official sources

- [Expo localization guide](https://docs.expo.dev/guides/localization/)
- [Expo Localization SDK](https://docs.expo.dev/versions/latest/sdk/localization/)
- [Expo Router static rendering](https://docs.expo.dev/router/web/static-rendering/)
- [i18next TypeScript](https://www.i18next.com/overview/typescript)
- [i18next configuration](https://www.i18next.com/overview/configuration-options)
- [i18next plurals](https://www.i18next.com/translation-function/plurals)
- [react-i18next TypeScript](https://react.i18next.com/latest/typescript)
