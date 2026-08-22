# ADR 0001: Bun and TypeScript monorepo

- Status: Accepted
- Date: 2026-08-22
- Owners: repository maintainers
- Supersedes: none

## Context

The universal app, API, authentication, database, contracts, and billing domain share TypeScript
types but have different trust and deployment boundaries. Separate repositories would add version
coordination before the product needs independent release trains. An unstructured single package
would let client/server/provider code couple accidentally.

## Decision

Use Bun 1.4.0 as the pinned runtime/package manager and Bun workspaces under `apps/*` and
`packages/*`. Use TypeScript, one committed root `bun.lock`, `workspace:*` internal dependencies,
Turborepo for the task graph, and Biome for repository formatting/linting.

Keep explicit workspaces for app, API, contracts, database, auth, and billing. The API is the server
composition root; domain packages never import application workspaces.

## Consequences

- One atomic change can update contract, server, client, and tests.
- Frozen installs reproduce one dependency graph.
- Package boundaries require manifests/exports and can reveal cycles early.
- A compromised shared toolchain affects multiple surfaces, so lockfile review and audit matter.
- An independently scaled/released component can be extracted later behind its existing contract.

## Alternatives considered

- npm/pnpm/Yarn: viable, but would add a second runtime/toolchain when Bun already runs the API/tests.
- Separate repositories: stronger administrative separation, currently excessive coordination.
- One package: simpler initially, insufficient client/server and domain boundaries.

## Validation

- `bun install --frozen-lockfile`
- `bun run check`
- `bun run build`
- workspace import/dependency review

## Official sources

- [Bun workspaces](https://bun.sh/docs/pm/workspaces)
- [Bun runtime](https://bun.sh/docs/runtime)
- [Bun lockfile](https://bun.sh/docs/pm/lockfile)
- [Turborepo repository structure](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
