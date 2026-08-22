# Versioning and upgrades

## Baseline snapshot

This table describes the reviewed baseline on **2026-08-22**. `package.json` files and `bun.lock`
remain the exact installed source of truth.

| Component | Baseline | Policy |
| --- | --- | --- |
| Bun | 1.4.0, engine `>=1.4.0` | Pin package manager/CI; test before raising minimum |
| Node.js for Expo tools | Repository range `>=24.19.0 <25`, pin 24.19.0; Expo floor 22.13.x | Follow `engines`, `.node-version`, Node LTS, and Expo matrix |
| Expo | 57.x | Upgrade one SDK at a time with Expo tooling |
| EAS CLI contract | `>=22.2.0` in `apps/app/eas.json` | Recheck build-profile schema and remote version behavior |
| React Native / React / RN Web | 0.86 / 19.2.3 / 0.21 | Keep Expo-supported matrix together |
| Hono | 4.13.3 | Exact direct dependency; review middleware/runtime changes |
| PostgreSQL | 18 (current community patch 18.6) | Test migrations and backups before major upgrade |
| Drizzle ORM / Kit | 0.45.2 / 0.31.10 | Review generated SQL and release notes |
| Better Auth / Expo adapter / `auth` CLI | 1.7.1 / 1.7.1 / 1.7.1 | Keep the synchronized release train aligned; regenerate/review auth schema |
| Polar Better Auth / SDK | 1.8.4 / 0.47.0 | Test checkout/webhook sandbox contracts |
| RevenueCat React Native SDK | Not installed in baseline | Pin deliberately when native IAP integration begins |
| TypeScript | 6.0.3 | Keep every workspace and Expo tooling compatible; no silent major jump |

On 2026-08-22, `bun outdated` reported only TypeScript `6.0.3 -> 7.0.2`. TypeScript 7 is a new
native compiler generation and does not yet expose the prior programmatic API. This baseline
intentionally retains 6.0.3 until Expo SDK 57, React Native, Bun, Biome, editor, test, and build-tool
compatibility have been validated together; "latest compatible" does not mean latest published.

## Dependency policy

- Direct server/domain dependencies use exact versions. Expo-managed packages use Expo-compatible
  ranges selected by `expo install`.
- Commit one root `bun.lock`; CI uses `bun install --frozen-lockfile`.
- Keep the root `bunfig.toml` hoisted-linker choice unless Expo Doctor proves an alternative has one
  physical copy of every native module; all workspaces still declare their own imports.
- Do not hand-edit the lockfile or mix a second root package manager/lockfile.
- Update one ecosystem at a time: tooling, Expo/native, API/auth, database, or provider integrations.
- Dependency PRs explain release notes, breaking changes, migrations, security impact, tests, and
  rollback.
- Avoid canary/beta packages in production unless a time-bounded ADR documents the need and exit.
- A package version update is incomplete until generated native config/schema/SQL artifacts are
  reviewed.

## API and schema compatibility

- `/v1` response meaning remains backward compatible. Additive optional fields are preferred.
- A breaking public request/response change requires a new version or measured compatibility window.
- Provider payload types never become public contracts.
- Database changes use expand/migrate/contract and support the prior application revision during
  traffic rollback.
- Entitlement keys are durable product contracts. Rename through an alias/data migration, not by
  silently changing a provider product mapping.

## Expo upgrade procedure

1. Read the target SDK release notes and compatibility matrix.
2. Upgrade one SDK version at a time.
3. Use Expo's supported install/fix command for managed dependency versions.
4. Run Expo Doctor.
5. Regenerate native projects if Continuous Native Generation requires it; review the diff.
6. Rebuild a development client because native module/runtime changes cannot be proven in Expo Go.
7. Test Android, iOS, and web routes, deep links, auth storage, and billing adapter selection.
8. Build preview binaries and repeat native purchase acceptance if RevenueCat/native code changed.

Do not independently bump React Native/React outside the matrix Expo documents for the selected SDK.

## Auth, database, and provider upgrades

### Better Auth

- Read migration/release notes and keep `better-auth`, `@better-auth/expo`, and the `auth` CLI on
  the same synchronized version. The installed CLI package is `auth@1.7.1`; the lockfile exposes its
  `auth` and `better-auth` binaries.
- Run `bun run auth:schema:generate` to produce reviewable CLI output, then
  `bun run auth:schema:check` to compare it with the Drizzle-owned schema. Generate and review a
  Drizzle migration for any intentional difference.
- Test existing sessions, new sign-in/sign-up, logout/revocation, native SecureStore, and origin/CSRF.
- Preserve secret-rotation compatibility.

### Drizzle/PostgreSQL

- Upgrade ORM and Kit in one focused change, then generate no-op/schema-diff evidence.
- Test every migration on empty and previous-data databases under PostgreSQL 18.
- For official PostgreSQL image upgrades, recheck the declared `PGDATA`/volume layout. Version 18+
  uses `/var/lib/postgresql` as the Compose volume target rather than the legacy
  `/var/lib/postgresql/data` target.
- For PostgreSQL major upgrades, test extensions, driver compatibility, backup/restore, connection
  path, query plans, and controlled cutover separately from an application feature release.

### Polar and RevenueCat

- Recheck API/webhook schemas, signature/authentication instructions, event identities, retry rules,
  sandbox separation, and product mapping.
- Replay maintained sanitized fixtures, then run provider sandbox acceptance.
- A RevenueCat SDK upgrade requires a new native build. Re-test purchase and restore on both stores.
- Provider dashboard configuration is versioned operational evidence even when it is not in Git.

## Repeatable upgrade audit

Run from a clean checkout. Commands that query registries/advisories require network access and do not
change dependency files unless a separate update command is run.

```sh
bun --version
node --version
docker --version
docker compose version
docker compose config --quiet
bun install --frozen-lockfile
bun run doctor
bun outdated
bun run audit:ci
bun audit
bun audit fix --dry-run
bun run check
bun run build
bun run db:check
bun run auth:schema:check
bunx expo-doctor@latest apps/app
```

On Windows PowerShell, use `bun.cmd` and `bunx.cmd` when script execution policy blocks the `.ps1`
shims.

Then complete and attach this checklist to the upgrade/release record:

- [ ] Compare all workspace manifests and `bun.lock`; explain every direct/transitive change.
- [ ] Read official release/migration notes for each changed component.
- [ ] Confirm Expo SDK/React Native/React/Node/OS matrix and run Expo Doctor.
- [ ] Run `db:check` and `auth:schema:check`; generate/review intentional Drizzle SQL and Better Auth
      schema changes; test empty and upgrade paths.
- [ ] Run Polar sandbox webhook/checkout tests if its packages or config changed.
- [ ] Build physical-device iOS/Android tests if Expo/native/RevenueCat changed.
- [ ] Re-open current Apple App Review 3.1 and Google Play Payments/US program pages.
- [ ] Re-open RevenueCat and Polar webhook security/event docs; update fixtures.
- [ ] Recheck Cloud Run container/secret/Cloud SQL/Tasks/Storage behavior if infrastructure changed.
- [ ] Record build/image digest, EAS IDs, migration result, canary metrics, and rollback compatibility.
- [ ] Update the baseline date/table, source index, and affected ADR if the decision changed.

`bun outdated` and `bun audit` are signals, not automatic authorization to update or proof that every
risk is absent. Review official advisories and actual reachability. Until compatible upstream fixes
land, the audit commands return nonzero for the explicitly reviewed transitive toolchain findings in
[Security](security.md#dependency-audit-snapshot); do not silently suppress them.

## Policy-drift audit

Store billing changes more quickly than code. For each mobile submission, record:

- review date and reviewer;
- app/storefront countries and distribution channel;
- whether Apple/Google native billing is used;
- any alternative-billing/external-link program enrollment and current terms;
- UI/metadata/review-note changes required by those terms;
- reporting, fees, and customer-support obligations;
- official URLs and effective dates.

If evidence is incomplete, retain the conservative native-store-only path and do not enable Polar
checkout in native.

## Official sources

- [Bun lockfile](https://bun.sh/docs/pm/lockfile)
- [Bun installation strategies](https://bun.sh/docs/pm/cli/install#installation-strategies)
- [Expo monorepos and duplicate native packages](https://docs.expo.dev/guides/monorepos/)
- [Bun outdated](https://bun.sh/docs/pm/cli/outdated)
- [Bun audit](https://bun.sh/docs/pm/cli/audit)
- [TypeScript 7.0 announcement and transition guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)
- [Expo SDK compatibility matrix](https://docs.expo.dev/versions/latest/)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Expo upgrade walkthrough](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [Better Auth migration guides](https://better-auth.com/docs/guides)
- [Better Auth CLI](https://better-auth.com/docs/concepts/cli)
- [Better Auth 1.7 upgrade guide](https://better-auth.com/docs/guides/1-7-upgrade-guide)
- [Drizzle releases](https://orm.drizzle.team/docs/latest-releases/drizzle-orm-v0450)
- [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/)
- [Official PostgreSQL image and 18+ data-directory notes](https://hub.docker.com/_/postgres)
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
