# Copy-ready handoff for the next Codex session

- Snapshot date: **2026-08-23**
- Latest implementation commit at snapshot time: **`b528485d6426512a2f306fd125cacb48f18d8b8b`**
- Authoritative continuation branch: **`fix/audit-remediation`**
- Authoritative continuation worktree: **`C:\Users\ADMIN\Desktop\pisto-app`**

This handoff replaces the earlier prompt that asked the next agent to implement sale correction.
Sale correction and the structured operating modules are already present. Repository evidence always
overrides this dated snapshot, so the next agent must recheck the branch, SHA, status, graph, and
worktrees before editing.

Paste the block below into a new Codex session opened in the authoritative continuation worktree.

```text
You are the lead engineer continuing Pisto. Begin in:

  C:\Users\ADMIN\Desktop\pisto-app

Do not begin from a folder merely because its name starts with `pisto-`. Most sibling folders are
Git worktrees created to isolate parallel writers. Some are integrated and clean; two contain
uncommitted work that must be preserved.

FIRST RESPONSE AND ORIENTATION

1. State the exact current path, branch, HEAD, working-tree status, local-main divergence,
   origin/main divergence, and `git worktree list --porcelain` result.
2. Read completely before planning a material change:
   - AGENTS.md
   - .agents/skills/pisto-architecture-delivery/SKILL.md
   - the installed product-ui-code-quality skill
   - docs/README.md
   - docs/product-goal.md
   - docs/product-briefs/pisto-ai-business-assistant.md
   - docs/product-capability-architecture.md
   - docs/engineering-workflow.md
   - docs/product-slices/operating-core-v1.md
   - the relevant accepted ADRs and domain guides
   - docs/ai-assistant.md in full for AI/model/tool/retrieval work
   - docs/voice-architecture.md in full for voice work
3. Inspect the implementation, public contracts, migrations, tests, manifests, lockfile, and CI.
   Treat code and Git evidence as authoritative. Several narrative status passages still lag the
   implementation; do not recreate something merely because an older paragraph calls it absent.
4. Use current official primary sources before any version-sensitive, provider-specific,
   security-sensitive, billing, policy, dependency, AI, voice, or cloud decision. Record durable
   decisions and their recheck trigger in the appropriate guide or ADR.

PRODUCT AND ARCHITECTURE

Pisto is a Spanish-first, AI-native operating assistant for entrepreneurs. A user should be able to
describe or speak what happened in the business, review a typed proposal, confirm it, and later ask
questions answered from verified business records. The structured product must remain completely
usable when AI or voice is disabled.

PostgreSQL and deterministic domain rules are authoritative. A model, transcript, retrieved passage,
client state, or provider response never owns money, tenant selection, authorization, calculations,
or persistence. Financial writes require a strict contract, fresh server authorization,
deterministic validation, explicit confirmation, idempotency, one transaction, and audit evidence.

Keep the modular-monolith ownership boundaries:

- apps/app: Expo Router UI and real platform adapters.
- apps/api: Hono HTTP composition, middleware, and request handling.
- packages/contracts: transport-neutral schemas and public API types.
- packages/db: PostgreSQL schema, migrations, repositories, and transactions.
- packages/auth: Better Auth server configuration.
- packages/billing: provider adapters and provider-neutral entitlement decisions.
- scripts: repeatable local CLI.
- docs: product/architecture/operations decisions with primary sources.

Use English for code, identifiers, tests, logs, errors, comments, and repository documentation.
Visible product copy uses the typed `es-SV` catalog and locale adapters. Preserve the ink/lime/cream
visual language. Avoid decorative glows, gradients, floating cards, excessive pills/shadows,
unowned buttons, fake metrics, fake activity, and success-shaped fallbacks.

GIT TRUTH AT THIS SNAPSHOT

- `C:\Users\ADMIN\Desktop\pisto-app` was clean on `fix/audit-remediation` at `b528485`.
- Local `main` was checked out separately in `C:\Users\ADMIN\Desktop\pisto-wt-base` at `3aa0175`.
- Remote `origin/main` was `d51c438`; GitHub reported the private repository
  `Eclalune-BTC/pisto-app` with default branch `main`.
- `fix/audit-remediation` was 34 commits ahead of local `main` and 51 commits ahead of
  `origin/main`, with no commits behind either. It had no upstream and was not pushed.
- Repository Git identity and the authenticated GitHub CLI user were
  `wkatir <wilmerhenrysalazarmartinez@gmail.com>` and `wkatir` respectively. Recheck both the CLI
  identity and credential helper immediately before any push.

The handoff documentation may be committed above `b528485`, so recheck rather than expecting HEAD to
equal that implementation SHA exactly. Do not pull, force-push, reset, clean, or switch branches until
you understand this graph and the protected worktrees below.

IMPLEMENTED ON THE AUTHORITATIVE BRANCH

- Universal Expo web/iOS/Android source, Hono API, PostgreSQL 18/Drizzle, Better Auth, and a Docker/
  Cloud Run deployment reference.
- Business onboarding with business-owned ISO currency and IANA time zone.
- Fresh active-business membership checks and static current-operation permissions for exact
  Better Auth `owner`, `admin`, and `member` roles.
- Total-only sale creation/read, previous-calendar-month gross/count/average, and transactional
  void/replacement correction with idempotency and audit paths.
- Authorized Operate hub and typed `es-SV` application copy.
- Categories/products plus searchable catalog, inventory stock, append-only movements, low-stock
  filtering, and one-time reversals.
- Cash accounts with derived balances, adjustments, transfers, movement history, and reversals.
- Paid expenses with listing, detail, period summary, posting, and void behavior linked to cash.
- Customers plus receivable charges, balances, payments, payment reversals, voiding, and summaries.
- Truthful loading, denied, error, uncertain-mutation, offline, and stale cached-read handling in the
  implemented operating screens.
- Conditional Polar web subscription checkout/portal/webhooks, provider-neutral entitlement
  projection, and an optional RevenueCat webhook adapter. These seams do not prove configured billing
  or native purchases.
- Migration `0003_worried_weapon_omega.sql` for the operating modules.
- Centralized API error translation, strict contracts, server-owned tenant resolution, and shared
  idempotent operation-log primitives.

KNOWN PRODUCT AND OPERATIONS GAPS

- There is no `GET /v1/sales` list. A previously posted sale cannot be rediscovered after the user
  navigates away, so the correction UI is not a complete historical workflow.
- The authoritative branch has an operating-report contract in
  `packages/contracts/src/reports.ts`, but no report repository, API route, or screen.
- No AI SDK/provider dependency, assistant package, assistant route, prompt, tool, or assistant UI is
  integrated on the authoritative branch.
- No microphone, transcription, voice UI, RAG, embeddings, pgvector, Neo4j, or GraphRAG capability is
  integrated.
- Entitlements are projected but do not yet gate product routes.
- Product-route distributed rate limiting and a server kill switch remain absent.
- Email verification/password-recovery delivery, invitations, role administration, and
  domain-specific team roles remain incomplete.
- The RevenueCat native SDK and native store purchase/restore UI are not installed.
- Cloud resources are not provisioned. Nothing in this snapshot is deployed or released.

PROTECTED WORKTREES

Do not run `git reset`, `git clean`, `git stash -u`, rebase, pull, checkout, worktree removal, or
branch deletion in either dirty worktree before preserving and reviewing its exact files.

1. `C:\Users\ADMIN\Desktop\pisto-reports-app`
   - Branch `feature/operating-reports`, base `c10f07c`; the authoritative branch was 39 commits
     ahead.
   - Dirty: five modified composition/export/test files and twenty untracked report implementation
     files across API, Expo UI, database, and tests.
   - The report contract commit is already integrated, but this implementation is not.
   - Treat this as substantial salvageable work. Review it for secrets/generated noise, create a
     recoverable checkpoint, and port it deliberately into a fresh worktree based on the validated
     authoritative branch. Do not blindly rebase or copy stale composition roots because API/DB/i18n
     ownership was consolidated after this worktree branched.

2. `C:\Users\ADMIN\Desktop\pisto-assistant-app`
   - Branch `feature/assistant-text-v1`, base `0ed4aa3`; the authoritative branch was 36 commits
     ahead.
   - Dirty: `apps/api/package.json`, `bun.lock`, and only two untracked package-scaffold files under
     `packages/assistant`.
   - There is no assistant source implementation. Treat it as an incomplete dependency spike, not a
     feature. Preserve it for review, but restarting the slice from the current validated base is
     likely safer than porting the scaffold.

The following clean worktrees had no unique unintegrated product work relative to the authoritative
branch and can be cleanup candidates only after validation, push, dirty-work preservation, and
explicit cleanup authorization:

- `pisto-cash-app`, `pisto-catalog-app`, `pisto-catalog-inventory`
- `pisto-customers-receivables`, `pisto-expenses-cash`, `pisto-receivables-app`
- `pisto-i18n-app`, `pisto-wt-api`, `pisto-wt-contracts`, `pisto-wt-db`, `pisto-wt-i18n`

Keep `pisto-wt-base` because it owns local `main`. Three internal `.claude/worktrees/agent-*`
worktrees were locked for Claude PID 16820. Do not unlock or remove them unless no Claude process or
session owns them and cleanup is explicitly authorized.

VALIDATION EVIDENCE RECORDED ON 2026-08-23

The following passed on implementation HEAD `b528485` before this handoff document was changed:

- `bun.cmd run doctor`: 0 failures and 0 warnings; no services started.
- `bun.cmd run check`: lint/docs/typechecks and 298 script/workspace tests passed.
- `bun.cmd run audit:ci`: no unreviewed vulnerabilities; 733 packages checked and four documented
  toolchain advisories ignored by policy.
- `bun.cmd run db:check`: committed Drizzle migration metadata passed.
- `bun.cmd run auth:schema:check`: configured Better Auth 1.7.1 schema matched.
- `bun.cmd run build`: all six workspaces built and Expo exported 83 static web routes.
- `git diff --check origin/main...HEAD`: passed in an independent read-only audit.

One independent cold-build attempt exported the routes and then returned a transient Expo exit code
while lingering MessagePorts/timeouts were reported; a direct app build and the subsequent root build
passed. Reproduce a cold build in CI instead of silently dismissing this observation.

PostgreSQL migration/integration tests were not rerun on `b528485` during this handoff audit. Earlier
database evidence belonged to an older SHA and must not be presented as validation of the current
branch. Responsive browser inspection, physical iOS/Android validation, provider sandbox evidence,
container deployment, and production smoke were also not performed for this SHA.

IMMEDIATE CONTINUATION SEQUENCE

Phase 1 — establish and publish one trustworthy baseline:

1. Recheck Git/worktree state and confirm `.env` points only to the intended disposable local
   PostgreSQL database before any migration or integration test.
2. From the authoritative worktree, run:

   bun.cmd install --frozen-lockfile
   bun.cmd run doctor
   docker compose up -d postgres
   bun.cmd run db:migrate
   bun.cmd run db:check
   bun.cmd run auth:schema:check
   bun.cmd run check
   bun.cmd run test:integration
   bun.cmd run audit:ci
   bun.cmd run build

3. Exercise the real authenticated local flow against PostgreSQL. Render and inspect compact web at
   390 CSS pixels, an intermediate width, and wide web. Record untested native/device/accessibility
   evidence explicitly.
4. Ask an independent read-only reviewer to inspect the full local-main-to-head diff, migrations,
   authorization, idempotency, error behavior, UI truthfulness, and validation claims. Resolve every
   material finding and rerun affected gates.
5. Reconcile the stale status passages in durable documentation. At this snapshot,
   `docs/product-goal.md`, `docs/sales-increment-1.md`, parts of the product brief,
   `docs/ai-assistant.md`, and `docs/security.md` still understate implemented operating capabilities.
6. Only after those gates, fast-forward local `main` in `pisto-wt-base`, recheck GitHub CLI and Git
   credential identity, push without force, and verify that the private remote `main` resolves to the
   exact intended SHA. Distinguish committed, pushed, deployed, and released.

Phase 2 — complete exact operating reports:

1. Preserve the dirty reports worktree before changing it.
2. Create a fresh reports branch/worktree from the newly validated baseline and manually port the
   useful implementation through the current contracts, API error boundary, DB ownership, typed
   i18n, permissions, and navigation composition.
3. Keep reports deterministic and PostgreSQL-backed. Separate period flows from current positions;
   do not call revenue profit, turn query failure into zero, invent trends, or add RAG/graph/model
   computation.
4. Run focused contract/API/database/UI tests, real PostgreSQL integration, rendered responsive
   review, full gates, and a fresh independent review before integration.

Phase 3 — assistant, then voice:

1. Do not adopt the partial assistant dependency scaffold blindly. Reopen current official AI SDK 7
   and candidate-provider documentation, complete the repository dependency/provider/privacy/cost/
   evaluation gates, and record the selected boundary and exit cost.
2. The first assistant slice must be bounded: structured Spanish interpretation can propose an
   editable sale draft or call an authorized exact report query. It cannot select a tenant, execute
   arbitrary SQL/HTTP, calculate canonical money, silently change providers, or commit a financial
   mutation without the existing confirmation transaction.
3. Preserve a complete structured fallback path when the provider is disabled or unavailable. This
   is an explicit degraded state, not fake assistant output or silent provider fallback.
4. Add bounded push-to-talk voice only after the text slice passes its semantic, security, cost,
   privacy, failure, cross-platform, and physical-device gates. Voice produces an editable transcript
   and reuses the text path; it is not a second financial execution path.

PARALLEL-AGENT RULES

Use read-heavy parallel agents for repository mapping, current primary-source research, test design,
and adversarial review. The lead freezes product/data/permission/public contracts before writers
start. Every parallel writer gets a separate Git worktree, dedicated branch, non-overlapping file
ownership, and an explicit deliverable. One integration owner reviews commits and resolves conflicts.
Do not claim Codex Ultra, Claude, a provider, a device, or a deployment ran without direct evidence.

FINISHING CONTRACT

- No invented scope, fake data, hidden fallback, speculative module, verbose wrapper, generic plugin
  system, duplicated domain logic, or one top-level tab per table.
- Add/update tests for business logic and security-sensitive behavior.
- Run `bun.cmd run check` and every applicable scope-specific gate.
- Finish material changes with an independent falsification review.
- Preserve unrelated work and secrets; never expose credentials in output or commits.
- Report separately: implemented, locally validated, built, committed, pushed, deployed, and released.
- Clean redundant worktrees only after their unique work is classified and preserved, the integrated
  commit is safely available, locked agent ownership is resolved, and cleanup is authorized.
```

## Why the Desktop has many Pisto folders

They are Git worktrees, not independent product copies. Each worktree lets one branch or agent work in
an isolated directory without overwriting another writer. They should be consolidated and removed
eventually, but deleting them before the two dirty branches are preserved would lose uncommitted work.
