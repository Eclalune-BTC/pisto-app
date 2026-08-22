# Testing and release

## What “done” means

Use precise status language:

| Status | Evidence |
| --- | --- |
| Implemented | Code and reviewable configuration exist |
| Locally validated | Named commands/tests passed in the local environment |
| Built | Reproducible app/container artifact was produced |
| Published/submitted | Artifact reached registry, EAS, or a store review channel |
| Deployed | A Cloud Run revision exists with intended configuration |
| Released | Production traffic/store availability and post-release checks are confirmed |

A green unit suite is not a deployment. An EAS build is not App Store/Play approval. A Cloud Run
revision with zero traffic is not a production release.

## Local quality gate

From a configured checkout:

```sh
bun run doctor
bun run check
bun run audit:ci
bun run build
bun run db:check
bun run auth:schema:check
```

The root `check` runs Biome, the documentation validator, all CLI/docs script tests, and workspace
typechecks/tests. It does not run the dependency audit, build, or database and Better Auth schema
checks, so those remain explicit commands above. `audit:ci` allows only the four reviewed transitive
toolchain advisories registered in [Security](security.md#dependency-audit-snapshot) and fails on an
additional advisory. A release records exact command output, commit, Bun/Node versions, and artifact
digest/build IDs.

## Test layers

| Layer | Focus | Representative evidence |
| --- | --- | --- |
| Static | TypeScript boundaries, Biome rules, forbidden imports | `bun run check` |
| Unit | Parsers, policy, entitlement evaluation, error mapping | Bun tests without network |
| Contract | Every success/error object matches `@pisto/contracts` | Route and schema tests |
| Database integration | PostgreSQL constraints, transactions, migrations, repositories | Fresh PostgreSQL 18 container |
| API integration | Hono middleware order, auth guards, CORS, errors, health | In-process Hono requests |
| Provider adapter | Signed/authenticated webhook fixtures, catalog allowlist, disabled state | Sandbox-safe adapter tests |
| App component/navigation | Loading/error/auth routing, accessibility, platform adapter selection | React Native/Expo test tooling |
| Native purchase acceptance | Real store sandbox purchase/restore lifecycle | Physical iOS/Android development/preview build |
| Deployment smoke | Container contract, DB connection, secrets, IAM, health, rollback | No-traffic/canary Cloud Run revision |

## Required security cases

- Unknown/missing fields and oversized input are rejected.
- Unauthenticated and unauthorized users cannot access protected routes or another subject's data.
- Credentialed CORS allows only exact configured origins.
- A deployed Cloud Run smoke verifies the client-IP header contract: a client cannot choose a
  rate-limit key with a spoofed `X-Forwarded-For` value, and ambiguous comma-separated chains use the
  documented shared per-path fallback until an explicitly trusted proxy/header is configured.
- Error and log capture contain no tokens, cookies, database URL, webhook secret, or signed URL.
- Invalid Polar signature and invalid RevenueCat auth/HMAC cause no durable entitlement change.
- Duplicate and older webhook events are safe.
- A revoked provider grant does not remove another active provider grant.
- Pending/unknown/expired grants fail closed.
- CLI `init` is repeatable and preserves existing environment files.
- Once a Cloud Tasks handler exists, task replay causes one domain effect.

## Database migration tests

For every migration:

1. Apply all migrations to an empty PostgreSQL 18 database.
2. Load the last supported schema/data snapshot and apply only new migrations.
3. Validate critical indexes, constraints, auth sessions, and entitlements.
4. Estimate or observe locks/runtime for large-table operations.
5. Deploy code compatible with both sides of expand/contract migrations.
6. Document forward recovery; do not promise a down migration that loses data.

## Billing acceptance matrix

### Polar web sandbox

- billing disabled/unconfigured;
- subscription products only; a one-time order event must not create an entitlement in this baseline;
- allowed and disallowed product slug;
- checkout creation and return without trusting return as payment proof;
- signed webhook, bad signature, duplicate, delayed, and out-of-order event;
- active, cancel-at-period-end, past-due/provider-specific retry, expiration, refund/revocation;
- portal authorization and wrong-subject access;
- sandbox/production identifier separation.

### RevenueCat and native stores

This matrix is a release gate for the future native integration. The baseline has a disabled native
billing adapter and does not install the RevenueCat React Native SDK, so these cases are not current
acceptance evidence.

- iOS and Android product/offering visibility with store-localized prices;
- success, user cancellation, pending purchase, and provider error;
- renewal, cancellation, billing issue/grace behavior, expiration, refund/revocation;
- Restore Purchases after reinstall and on another owned device;
- sign-out/sign-in and account switch without entitlement leakage;
- RevenueCat webhook auth/HMAC, duplicate/order handling, and backend projection;
- native build contains no Polar checkout call to action unless a separately approved regional ADR
  explicitly permits and scopes it.

Store sandbox evidence must include platform, app version/build number, product ID, test account type,
timestamp, and expected/actual entitlement key without recording payment credentials.

## CI and promotion gates

The included `.github/workflows/ci.yml` currently:

1. uses a clean checkout with Node 24.19.0 and Bun 1.4.0;
2. starts a PostgreSQL 18 service;
3. installs from `bun.lock` with `--frozen-lockfile`;
4. runs `bun run check`;
5. runs `bun run audit:ci` to reject advisories outside the reviewed exception set;
6. runs `bun run build`.

It does **not** currently run `doctor`, migrations, `db:check`, `auth:schema:check`, an API image
build/scan, or an Expo preview build. Those are not implied by a green CI workflow. The separate
Cloud Build reference does configure, execute, and wait for a migration job before its API deploy;
that is deployment-path configuration, not part of GitHub CI and not proof it has run.

A protected production promotion gate should additionally:

1. run non-secret-dependent doctor/config checks and both schema checks;
2. apply migrations to an ephemeral PostgreSQL 18 service and exercise database integrations;
3. build/scan the API image and record its immutable digest;
4. build Expo preview artifacts when native/config changes;
5. require review for migration, auth, billing, IAM, secret, or store-policy changes.

Do not inject production provider credentials into pull-request jobs from untrusted forks.

## API and Cloud Run release

1. Confirm change scope, source-policy audit, release notes, migration plan, and rollback owner.
2. Build and scan a single image; promote the digest rather than rebuilding per environment.
3. Run controlled migration job if required.
4. Deploy a no-traffic revision with production Secret Manager references and dedicated identity.
5. Smoke test health/readiness, auth, one authorized API path, database, and webhook rejection paths.
6. Shift a small traffic percentage; monitor error rate, latency, instance count, DB connections,
   task failures, auth errors, and billing webhook lag.
7. Increase traffic deliberately, then verify production from the user path.
8. Record revision, digest, migration, configuration, traffic, and verification evidence.

Rollback routes traffic to the previous compatible revision. If a migration/provider change is not
backward compatible, stop and use its forward-fix plan.

## Expo and store release

1. Run SDK compatibility/doctor checks and use a production EAS build profile.
2. Validate app identifiers, scheme, API origin, privacy declarations, permissions, icons, and
   version/build numbers.
3. Test the exact binary through internal/TestFlight/Play testing tracks.
4. Complete current Apple/Google billing-policy audit and review notes.
5. Submit through EAS Submit or the store workflow and record submission IDs.
6. “Released” only after store processing/approval and availability are verified.
7. Monitor auth, API, native crashes, purchase errors, webhook lag, and entitlement reconciliation.

An over-the-air update must stay within the native runtime compatibility boundary and cannot add or
change native RevenueCat modules. Use a new binary for native-code/config-plugin changes.

## Official sources

- [Bun test runner](https://bun.sh/docs/test)
- [Bun coverage](https://bun.sh/guides/test/coverage)
- [Expo unit testing](https://docs.expo.dev/develop/unit-testing/)
- [Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [EAS Build](https://docs.expo.dev/build/introduction/)
- [Expo distribution and submission](https://docs.expo.dev/distribution/introduction/)
- [RevenueCat sandbox testing](https://www.revenuecat.com/docs/test-and-launch/sandbox)
- [Polar sandbox](https://polar.sh/docs/integrate/sandbox)
- [Cloud Run rollouts and rollback](https://cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)
