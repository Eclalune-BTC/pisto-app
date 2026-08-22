# Repository layout

## Tree

```text
pisto-stack/
|-- .agents/skills/          # Versioned Codex workflows scoped to this repository
|-- .github/workflows/ci.yml # Frozen-install check/build workflow
|-- apps/
|   |-- app/                 # @pisto/app: Expo Router universal client
|   `-- api/                 # @pisto/api: Hono HTTP composition and Dockerfile
|-- packages/
|   |-- auth/                # @pisto/auth: Better Auth configuration and schema checks
|   |-- billing/             # @pisto/billing: providers and entitlement decisions
|   |-- contracts/           # @pisto/contracts: shared transport schemas and types
|   `-- db/                  # @pisto/db: Drizzle schema, migrations, repositories
|-- docs/
|   `-- adrs/                # Architecture and operating documentation
|-- infra/gcp/               # Reference cloud configuration; not deployment evidence
|-- scripts/
|   |-- dev-api.ts           # Root watch entry so shared package edits restart the API
|   |-- pisto.ts             # Safe local init/doctor/help CLI
|   |-- pisto.test.ts        # CLI safety tests
|   |-- validate-docs.ts     # Offline Markdown validation
|   `-- validate-docs.test.ts
|-- compose.yaml             # Local PostgreSQL 18 only
|-- AGENTS.md                # Root instructions loaded by Codex before project work
|-- .dockerignore            # Excludes local secrets, installs, and build output from image context
|-- .env.example             # Canonical server and Compose environment schema
|-- .node-version            # Node 24.19.0 toolchain pin
|-- package.json             # Workspace scripts and pinned toolchain
|-- bunfig.toml              # Hoisted linker for one Expo native-module installation
|-- bun.lock                 # Reproducible dependency graph
|-- turbo.json               # Cross-workspace task graph
|-- biome.json               # Formatting and lint policy
`-- tsconfig.base.json       # Shared TypeScript defaults
```

Generated directories such as `node_modules`, `.expo`, `.turbo`, `dist`, `build`, `coverage`, and
native Continuous Native Generation output do not define architecture and are not committed.

## Dependency direction

The manifests currently encode this dependency graph:

```text
apps/app --------> packages/contracts
apps/api --------> packages/auth, packages/billing, packages/contracts, packages/db
packages/auth ---> packages/billing, packages/db
packages/billing -> packages/contracts, packages/db

No package imports either application workspace.
```

Use `workspace:*` for internal dependencies so Bun links the local workspace and refuses accidental
publication against an unrelated registry package.

The root `bunfig.toml` deliberately selects Bun's `hoisted` linker. Expo native modules must resolve
to one physical installation; the isolated workspace layout produced duplicate native-module
installations during Expo Doctor validation. Hoisting is a compatibility decision, not permission
for undeclared dependencies: each workspace must still declare every package it imports.

## Placement rules

| Change | Location |
| --- | --- |
| Add a screen or platform-specific control | `apps/app/src` |
| Add or version an HTTP route | `apps/api/src` |
| Define a public request or response | `packages/contracts/src` |
| Add a table, index, query, or transaction | `packages/db/src` plus a migration |
| Change session or sign-in behavior | `packages/auth/src` |
| Add a billing provider or access rule | `packages/billing/src` |
| Add a safe developer workflow | `scripts` with tests |
| Change the Codex delivery workflow | `AGENTS.md`, `.agents/skills`, and the matching `docs` guide |
| Record an operational rule or decision | `docs` and, for architectural decisions, `docs/adrs` |

If a feature crosses boundaries, keep orchestration in the API and domain logic in the owning
package. Do not create a generic `utils` package for code with a clear owner.

## Public versus internal contracts

- A contract describes data crossing a boundary. It does not expose database row types or provider
  SDK payloads.
- API response types are additive within a version. Removing or changing meaning requires a new API
  version or a documented compatibility period.
- Repositories return domain-shaped results rather than leaking the Drizzle query builder.
- Provider adapters translate external states into the internal billing vocabulary at their edge.

## Local files and secrets

- `.env` is canonical server and Docker Compose configuration for local work.
- `apps/app/.env.local` contains public client configuration only.
- `.env.example` files document names and safe placeholders; they never contain working credentials.
- The lockfile is committed. Provider tokens, signing keys, service-account JSON, store credentials,
  and generated `.pem`/`.key` material are not.

## Official sources

- [Bun workspaces](https://bun.sh/docs/pm/workspaces)
- [Bun filtered scripts](https://bun.sh/docs/pm/filter)
- [Bun linker configuration](https://bun.sh/docs/pm/cli/install#installation-strategies)
- [Expo monorepos and duplicate native packages](https://docs.expo.dev/guides/monorepos/)
- [Turborepo repository structure](https://turborepo.com/docs/crafting-your-repository/structuring-a-repository)
- [TypeScript project references](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [OpenAI project instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [OpenAI repository-scoped skills](https://learn.chatgpt.com/docs/build-skills)
