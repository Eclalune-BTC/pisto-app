# Expo frontend and UI

## Baseline

`@pisto/app` is an Expo SDK 57 universal application using Expo Router. Expo's current compatibility
matrix pairs SDK 57 with React Native 0.86, React 19.2.3, React Native Web 0.21, minimum Node.js 22.13.x, Android
7/API 24+, and iOS 16.4+. The repository manifest is the exact dependency source of truth.

Expo Router owns navigation because one file-based route model supports Android, iOS, and web while
retaining platform-specific files and navigation where needed.

Expo web remains the authenticated product surface. Add a separate `apps/site` only when public
marketing/content has materially different SEO, CMS, server-rendering, content-deploy, or analytics
needs; do not force the product client to become a general content site or add a second frontend
without that requirement. See [Web deployment](web-deployment.md#public-website-boundary).

The client runs locally with Expo and the local Bun/Hono API. Its portable web export is a
single-page application (`web.output: single`); an export is not a publication. A future static host
would need deep-link routing through Expo Router and correct asset responses, but no hosting provider
or provider-specific runtime adapter is selected or required. See
[ADR 0017](adrs/0017-portable-postgres-and-hosting.md) and the
[local web workflow](web-deployment.md#current-local-workflow).

## Route model

`apps/app/src/app` currently contains 43 navigable routes plus a catch-all. The `Access` column names
the Pisto permission the API enforces for that screen's data; the screen hides or disables the action
when the resolved business access lacks it. The complete route inventory is:

### Public and account

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Product introduction and welcome actions |
| `/sign-in` | Public | Email/password sign-in, intended for signed-out users |
| `/sign-up` | Public | Account creation, intended for signed-out users |
| `/dashboard` | Authenticated | Compatibility redirect to `/operate` |
| `/business` | Authenticated; `business:configure` to create | One owner business create/select and settings confirmation |
| `/billing` | Authenticated | Plan, entitlement state, purchase/restore actions |
| `/billing/success` | Authenticated | Refresh entitlement state after returning from web checkout |
| `/settings` | Authenticated | Account, session, support identity, and sign-out |
| `+not-found` | Any | Unmatched path |

### Operate

| Route | Access | Purpose |
| --- | --- | --- |
| `/operate` | Authenticated | Module hub; lists only modules the current role can read |
| `/operate/sales` | `sales:summary:read` for summary; `sales:read` for history | Previous-calendar-month summary and bounded, status-filtered sale history |
| `/operate/sales/new` | `sales:create` | Total-only sale entry and review |
| `/operate/sales/:saleId` | `sales:read` | Canonical sale result |
| `/operate/sales/correct/:saleId` | `sales:correct` | Void or replacement review and confirmation |
| `/operate/reports` | `reports:read` | Exact date-range operating facts and separately labeled current positions |
| `/operate/expenses` | `expenses:read` | Expense period summary and list |
| `/operate/expenses/new` | `expenses:manage` and `cash:manage` | Paid-expense entry and review |
| `/operate/expenses/:expenseId` | `expenses:read`; void needs `expenses:manage` and `cash:manage` | Expense detail and void review |
| `/operate/cash` | `cash:read` | Accounts, derived balances, and movement history |
| `/operate/cash/accounts/new` | `cash:manage` | Account creation with an optional opening movement |
| `/operate/cash/accounts/:accountId` | `cash:read` | Account detail and archive review |
| `/operate/cash/accounts/:accountId/edit` | `cash:manage` | Account reference update |
| `/operate/cash/adjustments/new` | `cash:manage` | Manual adjustment entry and review |
| `/operate/cash/transfers/new` | `cash:manage` | Paired transfer entry and review |
| `/operate/catalog` | `catalog:read` | Product search, category filter, and stock summary |
| `/operate/catalog/new` | `catalog:manage` | Product creation and review |
| `/operate/catalog/categories` | `catalog:read`; mutations need `catalog:manage` | Category list, create, rename, archive |
| `/operate/catalog/:productId` | `catalog:read` | Product detail and archive review |
| `/operate/catalog/:productId/edit` | `catalog:manage` | Product update and review |
| `/operate/inventory` | `inventory:read` | Derived stock and low-stock filter |
| `/operate/inventory/:productId` | `inventory:read` | Signed movement history |
| `/operate/inventory/:productId/new` | `inventory:manage` | Receive or adjust entry and review |
| `/operate/inventory/:productId/reverse/:movementId` | `inventory:manage` | One-time movement reversal review |
| `/operate/customers` | `customers:read` | Customer search and list |
| `/operate/customers/new` | `customers:manage` | Customer creation |
| `/operate/customers/:customerId` | `customers:read` | Customer detail, contact, and receivable history |
| `/operate/customers/:customerId/edit` | `customers:manage` | Customer update |
| `/operate/customers/:customerId/archive` | `customers:manage` | Archive review |
| `/operate/receivables` | `receivables:read` | Business totals and state-filtered list |
| `/operate/receivables/new` | `receivables:manage` | Charge entry and review |
| `/operate/receivables/:receivableId` | `receivables:read` | Charge detail and payment history |
| `/operate/receivables/:receivableId/payment` | `receivables:manage` and `cash:manage` | Payment entry and review |
| `/operate/receivables/:receivableId/void` | `receivables:manage` | Void review |
| `/operate/receivables/:receivableId/payments/:paymentId/reverse` | `receivables:manage` and `cash:manage` | Payment reversal review |

Route groups and layouts may add file-system parentheses without changing these public paths. Keep
authentication gating in a layout/provider and enforce the same requirement on the API; client-side
redirects and permission-derived visibility are usability, not authorization.

`owner`, `admin`, and `member` can all reach the sales routes except correction; `member` lacks
`sales:correct`. `member` can also read catalog and stock but holds no expense, cash, customer, or
receivable or full-report permission, so the `/operate` hub does not list those modules for it. See
[ADR 0014](adrs/0014-static-current-operation-permissions.md) for the full matrix, including why
`admin` and `member` have no reachable actor today.

The generic planning dashboard has been removed; `/dashboard` is a five-line redirect kept only for
old links. Product navigation exposes `Operar` and `Cuenta`; `Operar` opens the `/operate` hub and
billing remains secondary account context. Reports is an Operate module at `/operate/reports`;
Assistant has no destination. Do not infer
future records, tabs, or workflows from the long-term capability map.

## Responsive shell

- Web uses a persistent sidebar when space permits and a compact header/navigation at narrow widths.
- Native uses platform-appropriate bottom navigation for authenticated top-level surfaces.
- Screens share tokens, typography, empty/loading/error states, and domain components.
- Platform-specific behavior uses `.web.tsx`, `.ios.tsx`, or `.android.tsx` only when the interaction
  materially differs. Business rules do not fork by platform.
- Safe-area insets protect content from device cutouts and system controls.
- Interactive controls have labels, roles, states, adequate hit targets, keyboard behavior on web,
  and VoiceOver/TalkBack verification.

Code reuse is not a claim of pixel or behavior parity. Routes, product state, tokens, copy, and
primitives stay shared when their semantics match. Navigation density, keyboard handling, safe
areas, pointer behavior, and provider entry points may adapt by platform. Prefer responsive shared
components for layout changes and narrow platform-resolved adapters for different capabilities.

## Product shell and feature composition

Top-level destinations represent durable user jobs, not packages or database modules. Increment 1
uses daily `Operar` plus `Cuenta`, with billing in secondary account context. Assistant is not exposed
until its structured proposal/query flow exists. Reports earns a permanent destination only after an
approved brief proves multiple recurring report jobs and direct-entry value. Home remains absent
until it has approved real orientation/attention content rather than invented dashboard filler.

- Keep only implemented durable compact destinations; wide web may reveal nested links without
  changing their meaning.
- Keep one typed destination model and let platform shells render it. Active state must match nested
  routes intentionally (for example, a billing return route remains inside Billing) rather than
  relying only on exact path equality.
- Do not add one tab per sales, inventory, customers, suppliers, expenses, or other capability.
- Do not turn Home into a feature-card directory. It shows real business state, attention, and the
  next useful action.
- A module normally lives inside an existing work area, record detail, contextual action, search
  result, or assistant tool.
- Use platform-specific navigation composition only for real native/web interaction differences.
  The destination map, route meaning, permission, and state vocabulary remain aligned.

Expo Router supports platform-resolved navigation layouts. Adopt that boundary when the real native
shell is implemented: use the installed stable Expo Router JavaScript `Tabs` on native and an
explicit web layout backed by the same typed destination model. A universal fallback route/layout
must remain for deep linking. Do not add another navigation dependency or adopt experimental native
or custom tabs without a demonstrated interaction requirement and SDK-specific evaluation. Do not
fork feature screens or business logic merely to change navigation chrome. See
[Product capability architecture](product-capability-architecture.md) and
[ADR 0011](adrs/0011-modular-capabilities-and-app-owned-composition.md).

The current route composition is a session guard, required business setup/selection, a workspace
layout containing only approved destinations, the `/operate` hub with its sales, expenses, cash,
catalog, inventory, customers, receivables, and reports routes, and secondary account/billing routes.
Home and Assistant remain absent until their approved content is implemented. Reports reuses the
Operate navigation instead of adding a permanent top-level tab.

## Screen and action contract

Every material screen defines context, content, truthful state, and owned actions. Every action must
name its user intent, record/context, destination or server effect, hierarchy, enabled/disabled state,
loading, success/error/retry behavior, duplicate-tap behavior, and accessibility semantics where
applicable.

- Use one primary action per decision region.
- Put record actions with the record. A global create/register entry can open a short task chooser,
  but it cannot become an unowned floating button for unrelated features.
- Keep assistant proposals visibly editable and separate from confirmed canonical results.
- Preserve a complete structured/manual route for any canonical operation when AI or voice is
  disabled or unavailable.
- Reuse a component when its semantics are stable. Do not build a flag-heavy universal screen merely
  to maximize code reuse.
- On web, every route exposes one meaningful page heading and semantic main/navigation/header regions
  as applicable. A `View` and visually large `Text` alone are not sufficient document semantics.

## Product visual language

Pisto keeps the ink, lime, cream, white, and semantic status palette defined in `global.css`. Build
hierarchy with type, spacing, alignment, and dividers before adding another decorated surface.

The [component design review](component-design-review.md) records the owner's preference for
restrained product UI and the local component changes. Use shared `Heading` variants instead of
inventing oversized, tightly tracked titles per screen. `global.css` owns adaptive semantic colors;
`ink` and `accent` remain immutable brand colors. `Page` owns bounded layout, while components in
`components/ui` own visual variants. Screen-level classes primarily compose layout. Decorative
vertical rules, promotional auth panels and numbered feature ornament are not default product UI.

- A card, pill, icon, shadow, gradient, or illustration must communicate grouping, interaction,
  state, hierarchy, feedback, or established brand character. If removing it preserves meaning and
  usability, simplify it.
- Do not combine decorative glows, floating or tilted cards, oversized rounding, sparkle icons,
  status-like pills, or repeated icon tiles merely to make a screen feel complete.
- Status badges remain appropriate for real states such as entitlement, verification, connection,
  and session status. Do not use them as ornamental section labels.
- Never invent progress, account activity, timing, plan names, catalog descriptions, testimonials,
  or security claims. Missing remote data receives an explicit loading, empty, unavailable, or
  error state.
- Do not expose controls that only mutate temporary component state while implying that a setting
  was saved. Implement persistence first or omit the control.
- Cards and rounded controls are not banned. Use them where a surface is independently actionable
  or where containment materially improves comprehension.

Visual cleanup preserves approved copy, product behavior, accessibility, and responsive intent. It
does not justify an unrelated redesign.

The manual increment uses neutral Latin American Spanish copy and Salvadoran `es-SV` money/date
formatting as its explicit initial product choice. Validate terminology and comprehension with
Salvadoran users before release. Code, identifiers, logs, tests, and repository documentation remain
English. Visible and accessibility copy lives in the typed `es-SV` i18next catalog; domain and
provider layers return stable English reason codes and never expose raw messages. `expo-localization`
reads system/app preferences, but unsupported preferences intentionally resolve to `es-SV` while it
is the only approved locale. See [ADR 0013](adrs/0013-es-sv-localization-boundary.md).

## Voice UI boundary

No voice dependency or surface exists today. A later approved push-to-talk slice uses a visible
record/stop/cancel control, keeps background recording off, records to cache, uploads through a
narrow authenticated multipart adapter, and returns editable text to the existing composer. It does
not submit or execute the transcript automatically.

Design permission, ready, recording/elapsed, stopped, discarded, uploading, transcribing, silence,
unsupported/too-large, offline, timeout, rate-limit/provider-error, aborted, retry, and transcript-
ready states explicitly. The microphone has a text label, keyboard/assistive-technology activation,
and non-color-only state. A waveform must communicate real level/status and have an accessible
alternative. Text remains complete when microphone access or transcription is unavailable.

Web microphone support requires a secure context, and Expo documents browser `MediaRecorder`
differences and missing Chrome WebM duration metadata. Validate exact formats and limits on the
supported device/browser matrix before adding a polyfill. Optional speech output is a separate later
capability with visible source text and explicit Listen/Pause/Stop controls; never autoplay.

See [Voice architecture and ElevenLabs evaluation](voice-architecture.md).

## Public configuration

Expo replaces statically referenced `process.env.EXPO_PUBLIC_*` values in the client bundle. Those
values are public even on native. Use dot notation, such as
`process.env.EXPO_PUBLIC_API_URL`, because Expo does not inline bracket access or destructuring.

| Variable | Scope | Rule |
| --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | All platforms | Exact API origin; local default is `http://localhost:3001` |
| `EXPO_PUBLIC_APP_SCHEME` | All platforms | Public deep-link scheme; keep it aligned with auth trusted origins |
| `EXPO_IOS_BUNDLE_IDENTIFIER` | App config/build | Unique environment-specific iOS identifier; not a credential |
| `EXPO_ANDROID_PACKAGE` | App config/build | Unique environment-specific Android application ID; not a credential |
| RevenueCat public SDK key | Native only, once integrated | Select per platform; public SDK keys are not server secrets |

The runtime uses `http://localhost:3001` only as a development fallback. For
`APP_VARIANT=production`, `app.config.ts` requires an explicit exact HTTPS API origin, a valid private
scheme, and non-placeholder app identifiers; `bun run doctor` repeats those checks. Production also
inspects the exported bundle for localhost and smoke-tests the exact artifact because configuration
validation alone does not prove the intended service was deployed.

## API and auth client

- Centralize base URL parsing and reject malformed or non-HTTP(S) URLs.
- Encode request/response shapes in `@pisto/contracts`; validate data at the network boundary.
- For browser sessions, send credentials only to the configured API origin.
- For Expo native Better Auth, use the official Expo client integration and SecureStore-backed cookie
  management. Include the application scheme (`pisto://`) in the server's exact trusted-origin list.
- Clear account-specific caches when identity changes. Never let one user's billing state appear for
  another user after sign-out/sign-in.
- Treat `RATE_LIMITED` and `WRITES_PAUSED` as explicit server failures. Do not show a committed result
  or automatically replay a business mutation because the server paused or throttled it.

## Billing UI boundary

Use a platform adapter with one UI contract:

```text
web     -> post an allowlisted slug -> open the authenticated API-returned Polar URL
iOS     -> RevenueCat SDK -> Apple in-app purchase sheet
Android -> RevenueCat SDK -> Google Play purchase sheet
```

The baseline native adapter reports billing unavailable; the iOS and Android branches above become
active only after the RevenueCat SDK integration and native release gate are complete.

There is no public direct Polar checkout environment variable: it would bypass the server's subject
binding and product allowlist. Native source code must not import or call the Polar checkout path for digital access. Show native
offering price strings supplied by the store, include Restore Purchases, and direct subscription
management to the platform that owns the purchase. The API entitlement remains authoritative for
server features.

Store rules have regional and program exceptions and can change. The conservative default above is
mandatory until a release-specific policy review explicitly approves another path. See
[Billing and entitlements](billing-entitlements.md#store-policy-and-regional-exceptions).

## Component stack and cross-platform rendering

Pisto does not use the web `shadcn/ui` components directly. Its component source is owned in
`apps/app/src/components/ui`, built with React Native primitives and styled through Uniwind.
The shadcn-like part is the source-owned composition and variant approach, not a browser component
library running on a phone. The app README's reference to React Native Reusables describes these
conventions; it is not evidence that the entire Reusables registry is installed.

| Layer | Current implementation | Source of truth |
| --- | --- | --- |
| Shared controls | Local Button, Field, Card, Heading and Alert built from React Native components | `apps/app/src/components/ui` |
| Composition primitive | `@rn-primitives/slot` 1.5.2 for `asChild` | `components/ui/button.tsx` |
| Styling | Tailwind CSS 4.3.3 and the free, JavaScript-based Uniwind 1.11.0 | App manifest, lockfile and Metro config |
| Variants and class merging | CVA, `clsx`, `tailwind-merge` and the local `cn` function | `components/ui/button.tsx`, `lib/cn.ts` |
| Icons | `lucide-react-native` backed by `react-native-svg` | App manifest and component imports |
| Platform rendering | React Native 0.86.3 on Android/iOS; React Native Web on browsers | Expo SDK 57 and installed dependencies |

There is no NativeWind integration or direct Radix/Base UI dependency in this app. Slot is the only
direct RN Primitives package currently installed; menus, dialogs and selects are not implicitly
provided. Evaluate a maintained native-compatible primitive when a real interaction needs it,
rather than pasting a web shadcn component into a shared native screen.

### What runs on each platform

The same feature screen imports `View`, `Text`, `Pressable` and `TextInput` from `react-native`.
On Android and iOS these render through React Native's native view implementation. On web,
React Native Web supplies the browser implementation. This is not a website embedded in a WebView.
Expo Router owns routes, and all three clients call the same Hono API; PostgreSQL and the server
packages do not run on the phone.

Uniwind's Metro integration processes Tailwind utilities and supplies native style values for
React Native components. The web target uses the browser styling path. Tailwind's build tooling
running on the development machine is different from a native module compiled into the mobile app.
Use the documented [supported class names](https://docs.uniwind.dev/class-names), not an assumption
that every browser CSS feature or third-party DOM component works on native. Browser selectors such
as `html`, `body` and `:focus-visible` in `global.css` do not establish native accessibility behavior.

The app shell currently uses a web-only wide sidebar and a shared compact/native bottom bar composed
of `Link`, `Pressable` and `SafeAreaView`. It is not a separate platform-native tab implementation.
Billing is resolved through `.web.ts` and `.native.ts` adapters; authentication and lifecycle handling
also contain explicit platform branches. Shared code preserves business meaning, not guaranteed
pixel identity, keyboard behavior or screen-reader acceptance. Windows currently uses the web target;
there is no React Native Windows desktop app in this repository.

## Styling and server-state ownership

Tailwind CSS 4.3.3 is integrated through Uniwind 1.11.0. `metro.config.js` wraps Expo's Metro
configuration with `withUniwindConfig`; `src/global.css` imports Tailwind and Uniwind and owns the
theme tokens. All styled application code lives under `src`, within that CSS entry's scan scope.
Keep `src/uniwind-types.d.ts` for typechecking before Metro generates its ignored `.expo` output.
This Metro integration needs no standalone Tailwind CLI, PostCSS configuration, or NativeWind Babel
preset. Recheck source discovery if styled code moves outside `src`.

TanStack Query owns server data. `providers/query-provider.tsx` creates a cache per authenticated
identity, connects Expo Network to `onlineManager`, and connects native AppState to `focusManager`.
Feature query modules own business-scoped keys, request cancellation, and mutation invalidation.
`lib/query-state.ts` owns shared denial, missing-data, and failed-refresh predicates; feature modules
translate those into their screen states. Unreviewed draft fields remain local UI state. New-sale
reviews are persisted on the server under [ADR 0018](adrs/0018-durable-sale-review.md); other editors
still have their documented recovery limits. Queries retry selected transient failures once;
financial mutations require explicit retries with the same idempotency key and are never queued
for automatic offline replay.

These integration choices were checked against the [Uniwind quickstart](https://docs.uniwind.dev/quickstart)
and [TanStack Query React Native guide](https://tanstack.com/query/latest/docs/framework/react/react-native)
on 2026-09-10. Recheck them when upgrading the styling, query, or Expo integration.

## Expo Go versus a development build

Tailwind 4 does not prevent Expo Go use. The installed free Uniwind version supports Expo Go;
Uniwind Pro's additional C++ engine requires a custom development build. Pisto has not installed Pro.
Expo Go itself contains native components and a fixed set of native libraries. The restriction is
adding native code that is absent from that binary, not using native components at all.

| Requirement | Expo Go | Custom development build |
| --- | --- | --- |
| Current React Native controls and free Uniwind styling | Supported by the underlying stack, with a matching Expo SDK | Supported by the underlying stack |
| SVG and Reanimated | Included in the matching Expo Go runtime; keep JavaScript versions compatible | Compiled from the app's selected native dependencies |
| App-specific native code and configuration | Cannot add arbitrary native modules or apply all app config changes | Rebuild after native dependencies or relevant config changes |
| Stable `pisto://` links and real app identity | Expo Go uses its own app identity and `exp://` links | Uses the app's compiled scheme and identifiers |
| Real native store purchases | Not an acceptance environment for Pisto purchases | Requires the future purchase integration and store sandbox tests |

### Authentication: check the effective plugin configuration

The native Better Auth client calls `Linking.createURL` to set its `expo-origin` header. Expo Go
resolves this to an `exp://` URL rather than registering Pisto's own scheme. However, the installed
`@better-auth/expo` 1.7.1 server plugin already adds `exp://` to its effective trusted origins when
the API process has `NODE_ENV=development`. Better Auth's custom-scheme matching accepts Expo Go
host URLs through that development entry. Production does not receive it.

A configuration-only probe of Pisto's actual `createAuth` composition on 2026-09-26 verified that
an example Expo Go origin is trusted in development and rejected in production, while an unrelated
HTTPS origin stays rejected. No database operation or device session was used. Checking only
`parseAuthConfig` would miss the plugin-provided development entry: that parser still rejects an
explicit `exp://` host or a broad wildcard pasted into `TRUSTED_ORIGINS` with `EXPO_SCHEME=pisto`.
Do not disable origin checks or change the app scheme merely to run Expo Go. Recheck the effective
plugin behavior whenever Better Auth changes.

Thus the stack does not rule out an Expo Go preview of Pisto. It still needs a compatible Expo Go
binary, a phone-reachable API URL and a real sign-in/session test. The configured desktop URL uses
`localhost`, which points to the phone itself when used on a physical device. No physical-device or
Expo Go session has been accepted by this documentation review. Follow
[device networking and startup](getting-started.md#phone-and-emulator-networking).

`eas.json` contains a development profile, but `expo-dev-client` is not installed and no development
binary is established by that file. A custom development build is the preferred ongoing native
development workflow for the app's real scheme, configuration and future native capabilities.
See [local native development builds](getting-started.md#local-native-development-build).

### Dependency review on 2026-09-26

The 20 installed app dependencies listed in the local Expo 57.0.21 compatibility metadata satisfy
that metadata. Separately, the online `expo install --check` returned exit 1 and recommended these
newer patches. Local metadata alignment is not the same as satisfying the latest online check.

| Package | Installed | Online recommendation |
| --- | --- | --- |
| `expo` | 57.0.21 | ~57.0.25 |
| `expo-constants` | 57.0.17 | ~57.0.19 |
| `expo-crypto` | 57.0.2 | ~57.0.3 |
| `expo-linking` | 57.0.9 | ~57.0.11 |
| `expo-localization` | 57.0.1 | ~57.0.2 |
| `expo-network` | 57.0.1 | ~57.0.2 |
| `expo-router` | 57.0.20 | ~57.0.23 |
| `expo-secure-store` | 57.0.3 | ~57.0.4 |
| `expo-splash-screen` | 57.0.8 | ~57.0.9 |
| `expo-web-browser` | 57.0.2 | ~57.0.3 |

No dependency was changed in this documentation task. This warning is not a demonstrated native
crash and is not caused by Tailwind 4. Review a coordinated Expo patch update before device acceptance,
then repeat the version, bundle and runtime checks. This table is a dated observation, not a future
install command or a reason to bypass the check.

Validation of the unchanged application source during this documentation review:

- `bun run check` with Bun 1.4.0 and Turbo task caching bypassed passed: 524 tests, workspace
  typechecks/builds and the web export. Documentation links and encoding also passed.
- The Node 24.19.0 Expo export for web, Android and iOS completed with exit 0 on a second invocation.
  The first all-platform invocation exited 1 after reporting bundles; its cause was not isolated.
  No application source or dependency changes were made between those attempts. The successful
  output is under the ignored `.cache/styling-platform-check-20260926` directory.
- These Android/iOS outputs are Hermes bundles, not installed APK/IPA builds, an Expo Go session
  or physical-device acceptance. Native runtime, session restoration, keyboard, safe-area and
  accessibility checks remain necessary.

The component and Expo Go explanation was checked against the installed source and the official
Uniwind, Expo, React Native and Better Auth references below on 2026-09-26. Recheck after changing
the styling engine, Expo SDK/native modules, auth integration or runtime environment.

## State conventions

Every remote screen handles:

1. initial loading without flashing the wrong auth/access state;
2. successful data;
3. empty state with a useful next action;
4. recoverable error with retry;
5. offline or stale state, clearly labeled;
6. forbidden/expired session by returning to sign-in;
7. billing pending/grace states without promising access that the API has not granted.

Avoid storing authoritative entitlements in generic local persistence. A cached value may improve
rendering but must be refreshed after purchase, restore, foregrounding, sign-in, and webhook-driven
server changes.

## Development and validation

```sh
bun run dev:app
bun --filter @pisto/app typecheck
bun --filter @pisto/app test
bun --filter @pisto/app build
```

The app's `turbo.json` includes `.env*` files and the public Expo variables, app variant, and
native identifiers in its build hash. Changes to these values invalidate the cached export;
strict environment mode also passes the explicitly declared configuration to Expo. Keep new
build-time variables in this package configuration when adding them.

Before adding native modules, use `npx expo install <package>` (or the Bun-compatible Expo invocation)
so versions match SDK 57. RevenueCat requires native code, so validate it in a development build and
store sandbox; Expo Go preview alone is not purchase acceptance evidence.

For material shell or route work, verify compact and wide web plus required native targets. Include
nested-route active state, keyboard order, visible focus, one page heading, semantic landmarks,
screen-reader names/states, safe-area behavior, and the documented loading/empty/error/disabled
states. Automated component/state coverage does not establish rendered or device acceptance.
[Release evidence](release-evidence.md) records the current browser checks and remaining physical-device
and screen-reader checks; do not infer deployed behavior or platform parity from a successful build.

## Official sources

- [shadcn source-owned components](https://ui.shadcn.com/docs)
- [React Native Reusables](https://github.com/founded-labs/react-native-reusables)
- [React Native core and native components](https://reactnative.dev/docs/intro-react-native-components)
- [Uniwind quickstart](https://docs.uniwind.dev/quickstart)
- [Uniwind free versus Pro and Expo Go compatibility](https://docs.uniwind.dev/pro-version)
- [Expo Go and development build FAQ](https://docs.expo.dev/develop/development-builds/faq/)
- [Expo SDK 57 linking and Expo Go URLs](https://docs.expo.dev/versions/v57.0.0/sdk/linking/)
- [Expo SDK 57 Reanimated](https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/)
- [Expo SDK 57 SVG](https://docs.expo.dev/versions/v57.0.0/sdk/svg/)
- [Expo SDK compatibility matrix](https://docs.expo.dev/versions/latest/)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Expo Router platform-specific modules](https://docs.expo.dev/router/advanced/platform-specific-modules/)
- [Expo Router SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
- [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo)
- [RevenueCat with Expo](https://www.revenuecat.com/docs/getting-started/installation/expo)
