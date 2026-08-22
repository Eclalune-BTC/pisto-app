---
name: pisto-architecture-delivery
description: Plan, implement, or review material Pisto product features, dependencies, integrations, architecture boundaries, auth, billing, data, infrastructure, or cross-platform behavior. Use for non-trivial build, refactor, or review work in this repository; do not use for trivial copy or formatting edits, pure status questions, or unrelated repositories.
---

# Pisto Architecture Delivery

Deliver the smallest truthful product slice while preserving Pisto's documented owners and evidence
standards.

## Before changing code

1. Read `AGENTS.md`, `docs/product-goal.md`,
   `docs/product-briefs/pisto-ai-business-assistant.md`,
   `docs/product-capability-architecture.md`, `docs/engineering-workflow.md`, and the relevant domain
   guide and ADRs. Read `docs/ai-assistant.md` completely for AI, voice, retrieval, model, or
   assistant work and `docs/voice-architecture.md` for voice work.
2. Inspect the current code, tests, manifests, and `git status`. Separate confirmed facts from
   assumptions and illustrative UI.
3. Confirm the exact user outcome, acceptance criteria, and non-goals. Use
   `docs/agent-feature-prompt.md` for a material assignment. Do not expand the approved first job into
   inventory, roles, RAG, voice, or a generic ERP without a separate approved brief.
4. Follow the research triggers and reuse-before-adding rubric in `docs/engineering-workflow.md`.
   Prefer current primary sources for external or version-sensitive decisions.
5. Trace the change through the existing application, contract, domain, persistence, provider, and
   platform boundaries. Use a pattern only for a demonstrated ownership or variation problem.
6. Complete the capability slice contract before material implementation. Name the structured/manual
   path and existing shell area; do not invent a plugin registry, empty package, or permanent tab.

## Implement and verify

- Build one complete vertical slice, not a collection of speculative foundations.
- Keep PostgreSQL and deterministic domain code authoritative. Treat model output and transcripts as
  untrusted; financial writes require explicit confirmation, fresh server authorization, deterministic
  money calculation, idempotency, transactionality, and audit evidence.
- Use relational queries for business facts. Add no silent model fallback, RAG, pgvector, Neo4j, or
  GraphRAG unless the documented evidence gate and an accepted ADR approve it.
- Preserve one source of truth and truthful loading, empty, error, denied, disabled, and recovery
  states. Never fabricate identity, access, product data, offline behavior, or success.
- Keep UI actions inside a clear task/record context with one primary action per decision region and
  explicit effect, hierarchy, disabled/loading/error, duplicate-tap, and accessibility behavior.
- Add tests for the risky public behavior and failure modes, then run the repository and
  scope-specific gates.
- For a material change, commission an independent read-only review as defined in
  `docs/engineering-workflow.md`. Resolve findings from evidence; skip the ritual for trivial edits.
- Update the affected guide, source index, environment example, migration, or ADR when its contract
  changed.

## Handoff

Lead with the observable result and remaining risk. Cite changed files and named validation. Keep
implemented, locally validated, built, pushed, deployed, and released status separate.
