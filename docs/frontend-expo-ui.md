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

The application shell is organized around these user journeys:

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Product introduction and welcome actions |
| `/sign-in` | Public | Email/password sign-in, intended for signed-out users |
| `/sign-up` | Public | Account creation, intended for signed-out users |
| `/dashboard` | Authenticated | Primary product surface |
| `/billing` | Authenticated | Plan, entitlement state, purchase/restore actions |
| `/billing/success` | Authenticated | Refresh entitlement state after returning from web checkout |
| `/settings` | Authenticated | Account, session, support identity, and sign-out |

Route groups and layouts may add file-system parentheses without changing these public paths. Keep
authentication gating in a layout/provider and enforce the same requirement on the API; client-side
redirects are usability, not authorization.

## Responsive shell

- Web uses a persistent sidebar when space permits and a compact header/navigation at narrow widths.
- Native uses platform-appropriate bottom navigation for authenticated top-level surfaces.
- Screens share tokens, typography, empty/loading/error states, and domain components.
- Platform-specific behavior uses `.web.tsx`, `.ios.tsx`, or `.android.tsx` only when the interaction
  materially differs. Business rules do not fork by platform.
- Safe-area insets protect content from device cutouts and system controls.
- Interactive controls have labels, roles, states, adequate hit targets, keyboard behavior on web,
  and VoiceOver/TalkBack verification.

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

## Official sources

- [Expo SDK compatibility matrix](https://docs.expo.dev/versions/latest/)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Expo Router SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/sdk/router/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Expo safe areas](https://docs.expo.dev/develop/user-interface/safe-areas/)
- [React Native accessibility](https://reactnative.dev/docs/accessibility)
- [Better Auth Expo integration](https://better-auth.com/docs/integrations/expo)
- [RevenueCat with Expo](https://www.revenuecat.com/docs/getting-started/installation/expo)
