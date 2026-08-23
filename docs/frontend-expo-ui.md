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
without that requirement. See [Web deployment](web-deployment.md#when-to-add-appssite).

## Route model

`apps/app/src/app` currently contains 42 navigable routes plus a catch-all. The `Access` column names
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
| `/operate/sales` | `sales:summary:read` | Previous-calendar-month sales summary |
| `/operate/sales/new` | `sales:create` | Total-only sale entry and review |
| `/operate/sales/:saleId` | `sales:read` | Canonical sale result |
| `/operate/sales/correct/:saleId` | `sales:correct` | Void or replacement review and confirmation |
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
receivable permission, so the `/operate` hub does not list those modules for it. See
[ADR 0014](adrs/0014-static-current-operation-permissions.md) for the full matrix, including why
`admin` and `member` have no reachable actor today.

The generic planning dashboard has been removed; `/dashboard` is a five-line redirect kept only for
old links. Product navigation exposes `Operar` and `Cuenta`; `Operar` opens the `/operate` hub and
billing remains secondary account context. There is no Assistant or Reports destination. Do not infer
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

- Keep three to five durable compact destinations; wide web may reveal nested links without changing
  their meaning.
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
catalog, inventory, customers, and receivables routes, and secondary account/billing routes. Home,
Reports, and Assistant are added only with real approved content, and none of the three exists.

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

Before adding native modules, use `npx expo install <package>` (or the Bun-compatible Expo invocation)
so versions match SDK 57. RevenueCat requires native code, so validate it in a development build and
store sandbox; Expo Go preview alone is not purchase acceptance evidence.

For material shell or route work, verify compact and wide web plus required native targets. Include
nested-route active state, keyboard order, visible focus, one page heading, semantic landmarks,
screen-reader names/states, safe-area behavior, and the documented loading/empty/error/disabled
states. The implemented screens have automated component and state coverage, but no rendered
responsive, physical-device, or screen-reader evidence is recorded for them. Treat these checks as
outstanding implementation acceptance criteria, not as shipped claims.

## Official sources

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
