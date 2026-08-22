# Pisto Stack contributor guide

## Start here

- Read `docs/README.md`, `docs/product-goal.md`,
  `docs/product-briefs/pisto-ai-business-assistant.md`, `docs/product-capability-architecture.md`,
  and `docs/engineering-workflow.md` before planning a material change. Then read the domain guide
  and accepted ADRs for the area you will touch. For AI, voice, retrieval, or model work, also read
  `docs/ai-assistant.md` completely; for voice, also read `docs/voice-architecture.md`.
- Inspect the current implementation, tests, package manifests, and `git status` before proposing
  work. Treat repository evidence as fact; label assumptions and unresolved product decisions.
- Do not infer real product behavior from illustrative UI, starter copy, package availability, or a
  future capability seam. If neither the user's request nor an approved product brief defines the
  exact user job, stop before implementation and request that decision.
- Use `docs/agent-feature-prompt.md` to frame a material delivery assignment for either Codex or
  Claude Code. `CLAUDE.md` imports these shared instructions for Claude Code; neither file proves that
  a particular agent runtime or external provider ran.

## Architecture boundaries

- apps/app owns the Expo Router user interface and platform adapters.
- apps/api owns HTTP composition, middleware, health checks, and request handling.
- packages/contracts owns transport-neutral schemas and public API types.
- packages/db owns PostgreSQL schema, migrations, and repositories.
- packages/auth owns Better Auth server configuration.
- packages/billing owns provider adapters and entitlement decisions.
- scripts owns the local CLI and must remain safe to run repeatedly.
- docs owns operational decisions and links to primary sources.

## Engineering rules

- Use English for source code, comments, command output, errors, and documentation.
- Follow the proportional research and review contract in `docs/engineering-workflow.md`.
- Research primary, current sources before deciding anything version-sensitive, security-sensitive,
  provider-specific, policy-dependent, unfamiliar, or architectural when it depends on an external
  fact. Stable internal decisions supported by repository evidence do not require ceremonial browsing.
- Before adding a production dependency, inspect built-in and already-installed capabilities, then
  compare a new library with a small local implementation. Record the reason, compatibility,
  maintenance/security evidence, and exit cost. Never add a wrapper that only renames a library.
- Prefer the smallest complete vertical slice and an existing repository boundary. Apply a named
  pattern only when its ownership or change-pressure problem exists; do not prebuild generic layers,
  roles, providers, or configuration for hypothetical use.
- Before adding a product capability, complete the slice contract in
  `docs/product-capability-architecture.md`. Keep application-owned composition explicit; do not add
  a self-registering module/plugin system, one top-level tab per feature, or an empty future package.
- Follow the product visual language in `docs/frontend-expo-ui.md`; preserve the Pisto palette and
  inspect rendered UI before making visual judgments.
- Do not add decorative glows, floating cards, gradients, pills, shadows, or icon tiles without a
  concrete hierarchy, interaction, state, feedback, or brand purpose.
- Never invent plan data, progress, account activity, saved settings, or success-shaped fallbacks to
  make an incomplete feature appear finished.
- Do not read provider credentials in client-side code.
- Treat model output, retrieved text, uploads, and transcripts as untrusted input. A model may propose
  typed drafts and bounded tools; it cannot choose a tenant, authorize itself, calculate canonical
  money, execute arbitrary SQL/HTTP, or commit a financial mutation without the approved confirmation,
  server authorization, deterministic validation, idempotency, transaction, and audit path.
- Use exact relational queries for transactional facts. Do not add RAG, pgvector, Neo4j, GraphRAG,
  silent provider fallback, or autonomous financial actions unless the evidence gates and ADR in
  `docs/ai-assistant.md` are satisfied.
- Treat billing webhooks as untrusted, retried, and possibly out of order.
- Keep the internal entitlement model provider-neutral.
- Keep web checkout disabled for native digital features by default. Any regional exception
  requires an explicit policy review, enrolled program, release gate, and dedicated ADR.
- Add an environment variable to the relevant .env.example when code requires it.
- Add or update a test for business logic and security-sensitive behavior.
- For a material change, ask an independent read-only reviewer or subagent to try to falsify the
  result when that capability is available. Resolve findings against evidence; do not delegate
  trivial edits merely to satisfy a ritual.
- Prefer read-heavy parallel agents. The lead resolves product/data/permission decisions and freezes
  public contracts before parallel writing. Every parallel writer uses a separate Git worktree on
  its own branch with non-overlapping file ownership; one integration owner reviews and integrates
  only the assigned commits.
- Run `bun run check` before handing work off. Run the additional scope-specific gates in
  `docs/engineering-workflow.md` and distinguish implemented, locally validated, built, pushed,
  deployed, and released.
