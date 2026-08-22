# Active product goal

- Status: **product-definition gate**
- Owner: **repository owner**
- Last reviewed: **2026-08-22**

## Goal

Turn the validated Pisto platform foundation into **one real, truthful, end-to-end product slice**
that works through the shared web, iOS, and Android architecture.

The first slice must let one authenticated user complete one approved money-related job using real
data and persistence. It must include the relevant UI, contract, API, authorization, database,
failure states, tests, and documentation. Platform behavior may differ where the capability differs,
but the product meaning must remain consistent.

This goal deliberately does not choose the first money job. The repository contains illustrative
planning language, not an approved product specification. A Codex agent must not turn that language
into accounts, budgets, goals, transactions, recommendations, roles, or fabricated data without the
owner approving the exact job and scope.

## What is already established

- The repository has explicit boundaries for a universal Expo client, Hono API, transport contracts,
  PostgreSQL/Drizzle persistence, Better Auth, provider-neutral entitlements, and deployment seams.
- The web, native, authentication, billing, data, and cloud foundations have documented invariants
  and primary-source references.
- Included scaffolding or a configured provider is not evidence that a complete product flow has been
  accepted, tested against its external service, deployed, or released.

See [Production capabilities](production-capabilities.md) for the exact included/seam/not-chosen
status. Do not duplicate that matrix here.

## Definition of ready

Before product implementation, create a short approved brief that answers all of these:

1. What exact decision or task can the user complete?
2. Who is the primary actor, and what authorization rule applies?
3. What starts the flow, and what observable outcome ends it?
4. Which data is authoritative, persisted, derived, sensitive, or intentionally not collected?
5. What are the success, empty, loading, validation, denied, error, retry, and recovery states?
6. What must behave the same across web, iOS, and Android, and which real platform capabilities differ?
7. What are the acceptance criteria and explicit non-goals?
8. Which external policy, API, dependency, or domain facts require current primary-source research?
9. What operational evidence is required beyond local tests?

If any answer changes the user outcome, data model, authorization model, or platform behavior, it is
a product decision, not a coding assumption.

## Definition of done for the first slice

The milestone is complete only when:

- the approved job is usable end to end with real persisted data;
- contracts, authorization, persistence, and platform adapters remain inside their documented owners;
- UI states are truthful and no fallback fabricates success, data, identity, access, or offline support;
- risky behavior and important failures have automated tests;
- the affected UI is rendered at representative web widths and exercised on required native targets;
- new dependencies and architectural decisions have recorded evidence and, when consequential, an ADR;
- an independent review finds no unresolved correctness, security, privacy, billing, or data-integrity
  blocker;
- the applicable local, provider, device, migration, build, and release gates in
  [Testing and release](testing-release.md) are recorded accurately.

## Next decision when the job is still unspecified

If neither the user's current request nor an approved brief already answers it, the next Codex should
begin with one focused product question:

> What is the first real money decision or task a new Pisto user should be able to complete?

After the owner answers—or when a specific current request already supplies the answer—the agent
should write or update the brief, research the affected domain and platform constraints, and propose
the smallest vertical slice. It should not implement a generic financial suite while that answer is
missing.

## Related sources

- [Pisto engineering workflow](engineering-workflow.md)
- [Pisto architecture](architecture.md)
- [OpenAI project instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [OpenAI Codex skills](https://learn.chatgpt.com/docs/build-skills)
