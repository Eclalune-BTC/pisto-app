# Pisto universal app

Expo SDK 57 application for iOS, Android, and the web. The app uses Expo Router, React 19, Uniwind, React Native Reusables conventions, RN Primitives, Better Auth, and TanStack Query.

## Setup

Install the monorepo once from its root:

```bash
bun install
```

Copy the public environment example and adjust values for your machine:

```bash
cp apps/app/.env.example apps/app/.env.local
```

`EXPO_PUBLIC_API_URL` defaults to `http://localhost:3001` in development. Better Auth is mounted at `/api/auth`, so the client resolves `http://localhost:3001/api/auth` locally. Production config requires an explicit HTTPS API origin.

The API must trust the configured app scheme, such as `pisto://`, for native authentication callbacks. Development-only `exp://` origins should be limited to development on the server.

## Commands

Run these from `apps/app`, or use the matching root workspace scripts.

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start Expo for interactive platform selection |
| `bun run android` | Start and open Android |
| `bun run ios` | Start and open iOS; a macOS host is required for the iOS simulator |
| `bun run web` | Start the web app |
| `bun run typecheck` | Check strict TypeScript |
| `bun run test` | Run app policy and configuration tests |
| `bun run lint` | Run Biome without interactive dependency installation |
| `bun run export:web` | Produce a static web export in `dist` |
| `bun run check` | Run lint, typecheck, tests, and the web export |

## Routes

- `/` — welcome
- `/sign-in` — email and password sign-in
- `/sign-up` — email and password registration
- `/dashboard` — signed-in overview
- `/billing` — current access and platform-appropriate billing controls
- `/billing/success` — post-checkout return that refreshes server-backed entitlements
- `/settings` — account, appearance, notification, and session controls

Signed-in routes use a shared responsive shell: a sidebar on wide web layouts and bottom navigation on native and compact web layouts.

## Billing policy

Billing uses platform-specific adapters:

- Web calls the authenticated API with an allowlisted catalog slug, then opens only the validated URL returned by `POST /v1/billing/checkout`. Portal management follows the same server-returned URL rule.
- iOS and Android use a typed, provider-neutral placeholder. It exposes existing entitlements but cannot purchase or manage access, and it contains no external checkout link. Replace it with an App Store and Play-compatible adapter such as RevenueCat before enabling native purchases.
- `checkout_id` on `/billing/success` is UX-only. The screen never treats it as proof of payment; it refreshes `/v1/billing/entitlements` and displays the server result.

## Build identifiers

Local development uses obvious placeholders in `app.json`:

- scheme: `pisto`
- iOS bundle identifier: `com.example.pisto`
- Android package: `com.example.pisto`

Set `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_APP_SCHEME`, `EXPO_IOS_BUNDLE_IDENTIFIER`, and `EXPO_ANDROID_PACKAGE` to owned release values. The EAS production profile sets `APP_VARIANT=production`, and `app.config.ts` intentionally fails when the API is not an explicit HTTPS origin, the scheme is invalid, or identifier placeholders remain. No EAS project ID is invented or committed.

## Key package versions

- Expo `57.0.15`, Expo Router `57.0.15`
- React `19.2.3`, React Native `0.86.2`, React Native Web `0.21.x`
- Uniwind `1.11.0`, Tailwind CSS `4.3.3`
- Better Auth and `@better-auth/expo` `1.7.1`
- TanStack Query `5.101.4`
- RN Primitives Slot `1.5.2`
- Vitest `4.1.11`, TypeScript `6.0.x`, Biome `2.5.10`
- EAS CLI production baseline `22.2.0`

The app was created with the official `create-expo-app` SDK 57 template and then reduced to the Pisto-specific implementation.
