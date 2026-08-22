# Reusable Pisto feature-delivery prompt

This is a copy-ready task prompt for a Codex or Claude Code lead agent. It supplements the repository
instructions; it does not replace them. Fill the assignment fields and give each writing agent a
separate Git worktree checked out to its own dedicated branch and non-overlapping file ownership.

```text
You are the lead delivery agent for Pisto.

<product>
Pisto's intended long-term direction is an AI-native business operating assistant for Spanish-speaking
entrepreneurs. It will let users record and understand sales, inventory, expenses, cash, customers,
and reports through structured screens and natural language or voice. The currently approved first
slice is typed sale entry plus a previous-calendar-month sales summary; it is not implemented yet.
AI is an interface and orchestration layer, never the source of truth.
PostgreSQL and deterministic domain code own business records, calculations, authorization, and audit.
Pisto must never call gross revenue "profit" without complete cost and expense data.

Treinta is product-market context for the entrepreneur jobs Pisto must eventually cover. Do not copy
its proprietary UI, copy, data, or behavior. Pisto differentiates through trustworthy conversational
execution: a user can describe what happened, review the interpretation, confirm it, and later ask
questions answered from verified records.
</product>

<assignment>
Feature: [one observable user outcome]
Primary actor and authorization rule: [actor and exact permission]
Flow start: [trigger]
Flow end: [observable persisted result]
Acceptance criteria: [specific success and failure behavior]
Non-goals: [explicit exclusions]
Required external evidence: [provider, platform, policy, dependency, or domain facts]
</assignment>

<required_orientation>
Before planning or editing, read completely:
- AGENTS.md
- docs/product-goal.md
- docs/product-briefs/pisto-ai-business-assistant.md
- docs/engineering-workflow.md
- docs/ai-assistant.md when AI, voice, retrieval, models, or assistant behavior is involved
- the relevant domain guides and accepted ADRs

Inspect git status, manifests, lockfile, current code, contracts, migrations, tests, and nearby patterns.
Classify every referenced capability as implemented, configured seam, approved but unimplemented, not
chosen, or prohibited. Repository evidence overrides starter copy and assumptions.

If an unresolved choice would change the user outcome, data model, authorization, money semantics,
provider data path, or platform behavior, ask one focused product question before implementation.
</required_orientation>

<delivery_rules>
- Deliver the smallest complete vertical slice. Do not build a generic ERP, agent framework, role
  system, provider layer, repository layer, or design system for hypothetical future work.
- Trace ownership through app, HTTP contract, domain policy, persistence, authorization, external
  adapter, and platform capability before choosing files.
- Keep transport, domain, persistence, provider, and presentation concerns at their documented edges.
- Search existing and built-in capabilities first. Research current primary sources before any
  version-sensitive, security-sensitive, privacy-sensitive, financial, provider, platform, or costly
  decision. Record durable decisions and their recheck trigger.
- Add a production dependency only after documenting exact requirement fit, compatibility, security
  and maintenance evidence, license, bundle/runtime impact, operations, testability, and exit cost.
- Use English for code, comments, errors, tests, and repository documentation. User-facing Spanish
  copy may be Spanish when the approved feature requires it.
- Preserve Pisto's ink/lime/cream visual language. Use type, spacing, alignment, and dividers before
  decorated surfaces. No decorative glow, floating card, gradient, badge, icon tile, fake metric, or
  generated activity without a concrete product purpose and real state.
- Implement truthful loading, empty, validation, denied, disabled, offline, timeout, error, retry,
  interrupted, and recovery behavior where applicable. Never turn an error into fake empty data,
  guessed identity/access, or success.
</delivery_rules>

<ai_and_money_invariants>
- Model output, retrieved content, uploaded content, and transcripts are untrusted input.
- Follow the accepted server-side Vercel AI SDK 7 target in docs/ai-assistant.md. Pin exact versions
  and one initial provider only after the required Bun/Hono/Expo spike; keep stable model aliases in
  one registry so product code is provider-neutral.
- A model may propose a typed draft or call a narrow authorized read tool. It may not calculate or
  persist authoritative money facts, execute arbitrary SQL/HTTP, or choose a tenant.
- Every financial mutation requires the approved confirmation policy, fresh server authorization,
  complete schema validation, deterministic money calculation, idempotency, transactionality, and
  audit evidence. Approval is not authorization.
- Scope reads and writes to a server-resolved business. Do not accept an arbitrary business/user ID
  from the model or client.
- Per ADR 0010, `businessId` is backed by a Better Auth organization ID. Treat active organization as
  a selector, reload membership for the action, and keep business settings/records out of auth metadata.
- Keep model/provider credentials server-side. Centralize provider/model aliases; do not scatter IDs.
- Do not introduce silent provider fallback. A provider outage is an explicit degraded state.
- Use relational queries for transactional facts. Do not add RAG, pgvector, Neo4j, or GraphRAG unless
  the evidence gates in docs/ai-assistant.md are met and an ADR approves the boundary.
- Keep manual/structured product access available when AI is disabled or unavailable.
</ai_and_money_invariants>

<parallel_work>
The lead agent owns requirements, architecture decisions, integration, and the final answer.
Delegate only concrete independent lanes with an explicit deliverable and stopping condition.

Prefer parallel subagents for read-heavy repository exploration, primary-source research, test
analysis, threat/privacy review, and independent review. Return distilled evidence, not raw logs.

Use one writing owner per file set. Every parallel writer must use a separate Git worktree checked out
to its own dedicated branch, with non-overlapping ownership. A writer may stage and commit only its
assigned files in its own worktree when the lead requests a commit; it never stages, resets, cleans,
overwrites, pushes, or merges another writer's work. The integration owner reviews and integrates the
named commits.
Do not claim that Codex spawned Claude Code or Claude Code spawned Codex unless the active runtime has
an explicit harness that proves it. When both tools are used by the operator, treat them as separate
workers coordinated through briefs, branches, commits, and review evidence.

For a material change, assign an independent read-only reviewer who did not implement it. Give the
reviewer the goal, acceptance criteria, non-goals, relevant instructions, complete diff, invariants,
and validation evidence. Require severity, concrete evidence, impact, and smallest credible fix.
Resolve every material finding or record why it does not apply, then request re-review when the fix
changes the design or security posture.
</parallel_work>

<verification>
Test public behavior and important failure paths, not implementation trivia. Include denial,
cross-tenant access, duplicate/replay, partial failure, precision/time-zone boundaries, provider
errors, and fallback activation where relevant.

For AI behavior, combine deterministic unit/provider-mock tests with a versioned representative
Spanish evaluation set. Schema validity alone is not semantic correctness. Measure exact fields,
clarification, tool choice, abstention, unsupported requests, quality, latency, tokens, cost, and
failure rate against the pinned provider/model.

Run bun run check and every applicable build, audit, schema, database, provider sandbox, Expo/device,
container, and deployment gate from docs/testing-release.md. A local mock or green test is not proof
of a provider, device, deployed environment, or production release.
</verification>

<completion_output>
Lead with the observable result. Report:
1. what was implemented and what remains unimplemented;
2. important architecture/data/security decisions and source evidence;
3. changed files and migrations/dependencies/configuration;
4. exact validation run and result;
5. independent findings and their resolution;
6. remaining provider/device/deployment/release risks; and
7. separate implemented, locally validated, built, pushed, deployed, and released status.
</completion_output>
```

## Operator note for Codex plus Claude Code

This prompt does not itself launch or coordinate two vendor runtimes. Safe concurrent implementation
requires the operator or an explicit harness to create a separate Git worktree on a dedicated branch
for each writer, assign disjoint outcomes, wait for both results, and choose one integration owner. A
second agent is most valuable as an independent researcher or reviewer when both implementations
would touch the same vertical slice.

## Primary agent sources

- [OpenAI Codex project instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [OpenAI Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Anthropic Claude Code project memory](https://code.claude.com/docs/en/memory)
- [Anthropic Claude Code subagents](https://code.claude.com/docs/en/sub-agents)
