# Contributing

Thanks for helping improve Pisto. This guide covers the workflow; the
[documentation map](docs/README.md) points to the guide for each area, and [AGENTS.md](AGENTS.md)
holds the full engineering rules shared by people and coding agents.

## Set up

Follow [Run it locally](README.md#run-it-locally), then run `bun run doctor` to check the
environment files and Docker.

## Branches and commits

- `main` holds stable releases; `develop` is the integration branch.
- Branch from `develop` as `feature/<name>` for product work or `docs/<name>` for documentation,
  and merge back with `git merge --no-ff`.
- Write commits in English with [Conventional Commits](https://www.conventionalcommits.org/):
  `type(scope): subject`, for example `feat(sales): void a sale from its detail screen`.

## Before opening a pull request

```sh
bun run check
```

Also run, when your change touches them:

| Change | Command |
| --- | --- |
| Database schema or repositories | `bun run db:generate`, review the SQL, then `bun run db:check` and `bun run test:integration` against a disposable database |
| Better Auth configuration | `bun run auth:schema:check` |
| API routes | `bun run smoke:local` and the [Postman collection](docs/postman/README.md) |
| Screens or user flows | `bun run test:e2e` ([end-to-end tests](docs/testing-release.md#end-to-end-tests)) |
| Dependencies | `bun run audit:ci` and the [dependency audit notes](docs/security.md#dependency-audit-snapshot) |

## Code rules in short

- Keep each change inside its package boundary (see [Architecture](README.md#architecture)); shared
  request and response shapes belong in `packages/contracts`.
- Store money as integer minor units and route every financial change through an idempotent,
  transactional command. Correct records with void or reversal entries.
- Treat missing required data as an error instead of falling back to an empty value.
- Comment only a non-obvious why. Add or update tests for business logic and security-sensitive
  behavior.
- The interface is Spanish (`es-SV`); code, comments and documentation are English.

## Reporting security issues

Do not open a public issue for a vulnerability. Contact the maintainers privately through GitHub's
security advisory form for this repository.
