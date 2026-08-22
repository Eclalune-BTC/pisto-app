# Copy-ready prompt for the next Codex session

Paste the block below into a new Codex session opened at the Pisto repository root.

```text
You are the lead engineer continuing Pisto in this repository. Work autonomously until the bounded
mission below is genuinely implemented and validated. Do not broaden it into future modules.

PRODUCT
Pisto is a Spanish-first operating assistant for entrepreneurs. Its long-term job is to let a user
describe or speak what happened in the business, review Pisto's typed interpretation, confirm it, and
later ask questions answered from verified records. It should eventually cover sales, inventory,
purchases, expenses, cash, customers, suppliers, reports, and team permissions without becoming a
flat collection of unrelated buttons or one tab per database table.

PostgreSQL and deterministic domain code are the source of truth. AI and voice will be interfaces to
the same authorized commands and queries; a model never owns money, authorization, calculations,
tenant selection, or persistence. Vercel AI SDK 7 is the accepted future orchestration target, but it
is not installed and no model/provider is selected. Do not add AI, voice, RAG, pgvector, Neo4j,
GraphRAG, or silent provider fallback in this mission.

CURRENT TRUTHFUL STATE
- The stack is Bun 1.4, Expo SDK 57/Expo Router universal app, Hono API, PostgreSQL 18/Drizzle,
  Better Auth organizations, provider-neutral billing seams, Docker, and a future Cloud Run target.
- Sales Increment 1 is implemented locally: one organization-backed business with create-once
  currency/time zone; exact static `owner`/`admin`/`member` current-operation permissions; manual
  total-only sale; visible review; idempotent transaction and audit receipt; canonical result;
  previous-calendar-month gross/count/average.
- Product routes are /business, /operate/sales, /operate/sales/new, and /operate/sales/:saleId.
- Visible product copy is served from one typed `es-SV` i18next catalog through Expo localization;
  logic and stable reason codes remain English. No second locale or in-app selector is implemented.
- The client never sends a businessId for financial operations. The server uses a fresh session,
  active organization selector, freshly loaded membership, and named Pisto action permission.
- JSON money is canonical minor-unit decimal strings; PostgreSQL stores positive bigint. The server
  freezes the ISO-currency minor-unit exponent on business settings and snapshots that exponent,
  local date, local time, and IANA time zone on every sale. Ambiguous/nonexistent local minutes fail.
- Migration `0002_faithful_quentin_quire.sql` upgrades the local Increment 1 schema without deleting
  existing local records. Preserve its fail-closed pre-release backfill policy and test both a clean
  PostgreSQL 18 database and an upgrade from the committed `0001` snapshot.
- The normal check suite, Expo web export, PostgreSQL 18 migration/integration test, and a real local
  browser flow passed. Nothing is deployed or production-released.
- Increment 1 is not the full approved sales milestone. Void/replacement correction, AI, voice,
  inventory, invitations/domain-specific team roles, email verification/recovery delivery, offline writes, configured billing,
  cloud provisioning, and production release remain incomplete.
- An ambiguous confirmation can be retried safely with the same in-memory command and idempotency key
  while the screen remains open. Recovery after reload or process death is not implemented. Do not
  store plaintext financial commands in web `localStorage`; design subject-bound retention and server
  reconciliation before claiming this recovery path.

IMMEDIATE MISSION
Finish the next narrow sales increment: an owner can correct one posted total-only sale by voiding it
and atomically creating a replacement. The original record remains immutable and visible as voided;
the replacement links to it; the audit history identifies actor, business, action, and both records;
the previous-month summary excludes the voided original and includes the replacement according to
replacement occurredAt. A sale may be corrected only once, and no operation may cross a business.

Deliver a structured UI flow from the canonical sale result: Correct sale -> edit replacement draft
-> review exact original and replacement -> confirm once -> canonical correction result. Handle
loading, validation, denied, already-corrected, cross-tenant/not-found, offline/ambiguous response,
retry, and replay states truthfully. Keep one primary action per decision region. Do not add a new
top-level navigation destination.

ORIENTATION AND SKILLS
Before planning or editing, read completely:
- AGENTS.md
- .agents/skills/pisto-architecture-delivery/SKILL.md
- the installed product-ui-code-quality skill
- docs/README.md
- docs/product-goal.md
- docs/product-briefs/pisto-ai-business-assistant.md
- docs/product-capability-architecture.md
- docs/engineering-workflow.md
- docs/sales-increment-1.md
- docs/adrs/0010-organization-backed-business-tenancy.md
- docs/adrs/0011-modular-capabilities-and-app-owned-composition.md
- docs/adrs/0012-total-only-sales-increment.md
- relevant API, database, auth, security, UI, and testing guides

Inspect git status, branch, manifests, lockfile, current contracts/schema/migration/repository/API/UI,
tests, and CI before changing files. Preserve unrelated user work. Repository evidence overrides this
prompt if they conflict. Use primary official sources for any fact that may have changed; record URLs
next to the decision they support. Search existing code and platform capabilities before adding a
dependency. Do not introduce a dependency unless the existing stack genuinely cannot satisfy the
requirement and the evidence gate in the engineering workflow passes.

ULTRA SUBAGENTS
Use all available concurrency slots deliberately, following current official Codex subagent guidance.
Keep one writer: you, the lead. Spawn three Codex Ultra read-only lanes in parallel:
1. Domain/data lane: map correction invariants, schema constraints, transaction/idempotency contract,
   summary effects, and minimum PostgreSQL tests. Stop with a concrete recommendation and blockers.
2. UX/cross-platform lane: map the existing web/mobile flow, correction state matrix, information
   hierarchy, accessibility, and anti-AI-slop review. Stop with route/component recommendations.
3. Security/test lane: threat-model fresh auth, named action permission, cross-tenant access, replay,
   partial failure, concurrent correction, and migration/CI evidence. Stop with severity-ranked gates.

Tell every lane to read the relevant repository instructions and return distilled evidence, not raw
logs. Wait for all three, reconcile conflicts, and freeze one contract before editing. Do not let
parallel agents write the same workspace. After implementation, reuse an Ultra agent that did not
write code for an independent read-only review of the complete diff and validation evidence. Resolve
every material finding and request re-review when a fix changes a boundary.

ARCHITECTURE AND QUALITY RULES
- Deliver the smallest complete vertical slice across contracts, transaction/persistence, API,
  authorization, Expo UI, audit, tests, docs, and migration. Do not build a generic ERP, workflow
  engine, event bus, repository framework, role system, package, service, or plugin registry.
- Keep capability composition explicit in the app/API roots. Extend the existing sales owner unless
  a demonstrated invariant justifies extraction.
- `packages/db/src/product.ts` currently combines business onboarding and the sales repository and is
  already large. Before adding correction, split it along those existing capability boundaries while
  preserving its public contract and transaction/auth invariants; do not introduce a generic
  repository framework.
- Use one transaction for the void, replacement, correction audit/idempotency receipt, and links.
  Approval is not authorization: reload fresh action permission inside the transaction.
- Preserve exact idempotency semantics: same actor/business/key plus same canonical command replays the
  same correction result; the same key with changed input conflicts. Concurrent confirmations must
  create one correction only. Injected failure must leave no partial void/replacement/audit state.
- Never update authoritative money using JavaScript float. Never call revenue profit. Never turn a
  query error into zero, a stale role into access, or an ambiguous mutation into success.
- The client may propose local date/time, amount, and description. The server resolves and validates
  all canonical fields using the business currency/time zone. Do not accept tenant, actor, role,
  status, original total, or audit fields from the client.
- Preserve the ink/lime/cream visual language. Use type, spacing, alignment, and dividers before
  surfaces. Avoid decorative glow, gradients, floating cards, fake metrics/activity, icon tiles,
  generic dashboard copy, excessive rounded boxes, and loose buttons without a task owner.
- Share semantic UI, validation, contracts, and state rules across Expo web/iOS/Android. Use a platform
  adapter only for a real platform difference.
- Use neutral Latin American Spanish for visible product copy and English for code, tests, comments,
  and repository documentation.
- Keep correction/void terminology exact and explain its effect. Do not physically delete financial
  records. Do not expose Better Auth organization/member mutations.

MINIMUM EVIDENCE
- Strict contract tests, including unknown fields and bigint boundaries.
- PostgreSQL 18 migration from a clean database.
- Real database tests for success, sequential and concurrent replay, changed-payload conflict,
  already-corrected conflict, cross-tenant denial, injected rollback, previous-month boundaries, and
  original/replacement occurrence-time behavior.
- API tests for unauthenticated, missing active business, non-owner, malformed ID/body, not found,
  conflict, and stable canonical result.
- UI/unit tests for exact money parsing/formatting and correction state rules where practical.
- bun run check, explicit database integration test, bun run build, and responsive web inspection at
  wide and compact viewport. Validate a real local correction flow against PostgreSQL.
- Run the dependency audit and auth/schema checks required by docs/testing-release.md. Do not claim
  device, provider, container, deployed, or production evidence that was not actually run.

FINISHING CONTRACT
Update durable documentation and add/supersede an ADR if a material boundary changes. Commission the
independent Ultra review and resolve its findings. If the worktree started clean and repository
instructions/user authorization still permit it, make a focused commit using the configured wkatir
identity and push to the existing private Eclalune-BTC/pisto-app remote; never include secrets or QA
credentials.

In the final response, lead with the observable outcome. Separate: implemented, locally validated,
built, pushed, deployed, and released. List exact checks, migration, independent findings/resolution,
and remaining blockers. Explicitly say that AI/voice and production readiness remain incomplete.
```

## Why the prompt uses one writer

Current Codex guidance favors parallel subagents for read-heavy exploration and independent review,
while simultaneous writers require carefully isolated worktrees and file ownership. This prompt uses
three Ultra read-only lanes and keeps integration with one lead writer so the financial contract is
frozen before code changes.

Source: [OpenAI Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).
