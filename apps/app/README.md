# Pisto universal app

Expo SDK 57 application for iOS, Android, and the web. The app uses Expo Router, React 19,
source-owned React Native components, free Uniwind, Tailwind CSS 4, Better Auth, and TanStack Query.

## Styling and platform support

This is not a direct installation of web shadcn/ui. `src/components/ui` owns the shared controls;
`@rn-primitives/slot`, CVA and `cn` support composition and variants. React Native Reusables is a
convention/reference, not a claim that its complete component registry is installed. NativeWind is
not used. `src/global.css` owns tokens, and `metro.config.js` connects Tailwind to Uniwind.

Free Uniwind supports Expo Go; Tailwind 4 alone does not require a native build. A matching SDK,
reachable API, authentication and device behavior still need verification. The full explanation,
including the installed auth plugin's development origins and current Expo patch recommendations,
is in [the frontend guide](../../docs/frontend-expo-ui.md#expo-go-versus-a-development-build).

## Setup

For the already configured desktop checkout, use the
[Windows startup instructions](../../docs/getting-started.md#existing-windows-workspace) rather
than starting a second database with the default Compose project.

For a fresh checkout, install the monorepo once from its root:

```bash
bun install --frozen-lockfile
```

Create missing local configuration without overwriting existing files:

```bash
bun run setup
```

`EXPO_PUBLIC_API_URL` defaults to `http://localhost:3001` in development. Better Auth is mounted at `/api/auth`, so the client resolves `http://localhost:3001/api/auth` locally. Production config requires an explicit HTTPS API origin.

The API trusts the configured app scheme, such as `pisto://`, for native authentication callbacks.
The installed Expo auth plugin adds `exp://` only when the API process is in development mode.
Do not paste broad Expo Go wildcards into Pisto's environment parser or weaken production checks.

## Commands

Run these from `apps/app`, or use the matching root workspace scripts.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start Expo for interactive platform selection |
| `bun run android` | Start Metro and open Android; does not compile a native binary |
| `bun run ios` | Start Metro and open iOS; does not compile a binary; the iOS simulator requires macOS |
| `bun run web` | Start the web app |
| `bun run typecheck` | Check strict TypeScript |
| `bun run test` | Run app policy and configuration tests |
| `bun run lint` | Run Biome without interactive dependency installation |
| `bun run export:web` | Produce a static web export in `dist` |
| `bun run check` | Run lint, typecheck, tests, and the web export |

See [Expo Go preview](../../docs/getting-started.md#expo-go-preview) and
[native build setup](../../docs/getting-started.md#local-native-development-build) for the different
workflows. The EAS development profile is present, but `expo-dev-client` is not installed.

## Routes

- `/` — welcome
- `/sign-in` — email and password sign-in
- `/sign-up` — email and password registration
- `/dashboard` — compatibility redirect to `/operate`
- `/business` — business creation and selection
- `/operate` — authorized sales, catalog, inventory, cash, expense, customer, receivable, and report workflows
- `/billing` — current access and platform-appropriate billing controls
- `/billing/success` — post-checkout return that refreshes server-backed entitlements
- `/settings` — account identity, appearance, billing access, and sign-out

The complete route and permission inventory is in [the frontend guide](../../docs/frontend-expo-ui.md#route-model).

Signed-in routes use a shared responsive shell: a sidebar on wide web layouts and bottom navigation on native and compact web layouts.

## Billing policy

Billing uses platform-specific adapters:

- Web calls the authenticated API with an allowlisted catalog slug, then opens only the validated URL returned by `POST /v1/billing/checkout`. Portal management follows the same server-returned URL rule.
- iOS and Android use a typed, provider-neutral placeholder. It exposes existing entitlements but cannot purchase or manage access, and it contains no external checkout link. Replace it with an App Store and Play-compatible adapter such as RevenueCat before enabling native purchases.
- `checkout_id` on `/billing/success` is UX-only. The screen never treats it as proof of payment; it refreshes `/v1/billing/entitlements` and displays the server result.

## Build identifiers

Local development uses explicit defaults in `app.config.ts`:

- scheme: `pisto`
- iOS bundle identifier: `com.example.pisto`
- Android package: `com.example.pisto`

Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_SCHEME`, `EXPO_IOS_BUNDLE_IDENTIFIER`, and `EXPO_ANDROID_PACKAGE` to owned release values. The EAS production profile sets `APP_VARIANT=production`, and `app.config.ts` intentionally fails when the API is not an explicit HTTPS origin, the scheme is invalid, or identifier placeholders remain. No EAS project ID is invented or committed.

## Key package versions

- Expo `57.0.21`, Expo Router `57.0.20`
- React `19.2.3`, React Native `0.86.3`, React Native Web `0.21.x`
- Uniwind `1.11.0`, Tailwind CSS `4.3.3`
- Better Auth and `@better-auth/expo` `1.7.1`
- TanStack Query `5.101.4`
- RN Primitives Slot `1.5.2`
- Vitest `4.1.11`, TypeScript `6.0.x`, Biome `2.5.10`
- EAS CLI production baseline `22.2.0`

The app was created with the official `create-expo-app` SDK 57 template and then reduced to the Pisto-specific implementation.
