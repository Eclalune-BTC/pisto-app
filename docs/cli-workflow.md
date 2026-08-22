# CLI workflow

The repository-local CLI lives at `scripts/pisto.ts` and runs directly with Bun:

```sh
bun run scripts/pisto.ts help
```

Root aliases are `bun run setup` for `init` and `bun run doctor` for `doctor`.

## Safety contract

The CLI may create local environment files inside this repository. It does not:

- overwrite or merge an existing environment file;
- print generated or configured secret values;
- install dependencies;
- start Bun, Expo, Docker, PostgreSQL, or any background process;
- connect to the database or a provider;
- create or modify Polar, RevenueCat, Apple, Google Play, or Google Cloud resources;
- deploy, migrate, seed, delete, or reset anything.

File creation uses exclusive-create semantics. If another process creates a target between the
existence check and the write, the CLI preserves that file.

## `init`

```sh
bun run scripts/pisto.ts init
```

Targets:

| Target | Template | Behavior |
| --- | --- | --- |
| `.env` | `.env.example`, or a safe built-in fallback | Inserts a fresh 32-byte Better Auth secret |
| `apps/app/.env.local` | `apps/app/.env.example`, or a public-only fallback | Copies public local configuration |

An existing target is reported as `PRESERVED` and is not opened for writing. The Better Auth secret
is generated with the operating system cryptographic random source and encoded as base64url. A value
from `.env.example` is never reused as the local secret.

Preview without writing:

```sh
bun run scripts/pisto.ts init --dry-run
```

After initialization, manually review URLs and origin allowlists. A generated secret makes local
development safer; it does not provision production secrets.

## `doctor`

```sh
bun run scripts/pisto.ts doctor
```

Doctor is read-only. It checks:

- the running Bun version against the repository minimum;
- the installed Node.js version against the supported `>=24.19.0 <25` range (above Expo SDK 57's
  documented 22.13.x floor);
- the pinned package manager, lockfile, and required hoisted linker in `bunfig.toml`;
- the aligned `better-auth`, `@better-auth/expo`, and `auth` CLI 1.7.1 toolchain with no legacy CLI
  lock entry;
- Docker CLI, Compose plugin, and whether the engine is reachable;
- static parsing of `compose.yaml` through `docker compose config --quiet`;
- required workspace configuration and the PostgreSQL 18 image/volume target;
- presence of local environment files;
- PostgreSQL and HTTP URL syntax;
- API/database numeric ranges, the exact `DATABASE_SSL` enum, and accepted boolean switches;
- Better Auth secret length, exact origins, production HTTPS, reserved/example hostnames, and obvious
  placeholders without printing the value;
- known server-only keys accidentally placed in the Expo local environment;
- Polar variables and basic JSON/URL configuration only when `BILLING_ENABLED` is enabled;
- RevenueCat webhook variables and entitlement-map configuration only when `REVENUECAT_ENABLED` is
  enabled;
- app scheme/identifier syntax and, for `APP_VARIANT=production`, a non-local HTTPS API origin and
  non-example application identifiers.

Statuses:

- `PASS`: the check is satisfied.
- `WARN`: development can remain intentionally unconfigured, or a local service is stopped.
- `FAIL`: the repository or selected feature is unsafe or unusable. Doctor exits with code 1.

Doctor reads process environment variables before local file values. This lets CI inject secrets
without writing them to disk. It reports variable names only.

## `help`

All of these are equivalent:

```sh
bun run scripts/pisto.ts help
bun run scripts/pisto.ts --help
bun run scripts/pisto.ts -h
```

A help request takes precedence, prints usage, and exits 0. Without `--help` or `-h`, unknown
commands and operational flags return exit code 2 and show usage.

## Validation

The safety behaviors are covered by `scripts/pisto.test.ts`:

```sh
bun test ./scripts
```

The tests use operating-system temporary directories, verify exclusive creation and repeatability,
and remove only the temporary directories they created.

## Troubleshooting

| Symptom | Action |
| --- | --- |
| PowerShell blocks `bun.ps1` | Run `bun.cmd` instead of `bun` |
| `.env` is preserved but wrong | Edit it manually; the CLI will not replace it |
| Docker CLI passes but engine warns | Start Docker Desktop, then rerun doctor |
| Billing fails while disabled | Keep provider variables empty and confirm `BILLING_ENABLED=false` |
| Billing fails while enabled | Configure every named Polar server variable; never move it to Expo env |
| Native webhook projection fails | Review the RevenueCat Authorization, optional signing secret, non-empty entitlement map, and signature tolerance |

## Official sources

- [Bun TypeScript runtime](https://bun.sh/docs/runtime)
- [Bun environment loading](https://bun.sh/docs/runtime/environment-variables)
- [Bun linker configuration](https://bun.sh/docs/pm/cli/install#installation-strategies)
- [Expo monorepos and duplicate native packages](https://docs.expo.dev/guides/monorepos/)
- [Node cryptographic random bytes](https://nodejs.org/api/crypto.html#cryptorandombytessize-callback)
- [Better Auth secret requirements](https://better-auth.com/docs/installation)
- [Expo public environment variable warning](https://docs.expo.dev/guides/environment-variables/)
