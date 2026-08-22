# Active product goal

- Status: **first product slice approved; implementation not started**
- Owner: **repository owner**
- Last reviewed: **2026-08-22**

## Goal

Turn the validated Pisto platform foundation into **one real, truthful, end-to-end product slice**
that works through the shared web, iOS, and Android architecture.

The approved first slice lets one authenticated business owner describe a sale in conversational
Spanish, review and confirm the typed draft, persist it exactly once, and later ask how the previous
calendar month went. The answer is calculated from canonical sales records in the business time zone;
it reports revenue truthfully and does not call it profit without cost and expense data.

The full product definition, data and action contracts, acceptance criteria, and exclusions are in
[Pisto AI-native business assistant](product-briefs/pisto-ai-business-assistant.md). That brief approves
the job, not its implementation and not every future Pisto module.

## What is already established

- The repository has explicit boundaries for a universal Expo client, Hono API, transport contracts,
  PostgreSQL/Drizzle persistence, Better Auth, provider-neutral entitlements, and deployment seams.
- The web, native, authentication, billing, data, and cloud foundations have documented invariants
  and primary-source references.
- Included scaffolding or a configured provider is not evidence that a complete product flow has been
  accepted, tested against its external service, deployed, or released.

See [Production capabilities](production-capabilities.md) for the exact included/seam/not-chosen
status. Do not duplicate that matrix here.

## Definition of ready — satisfied for the first slice

The approved product brief answers these questions for the first slice. Every later module or material
scope change must answer them again:

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

## Next delivery decision

The next delivery agent should plan the smallest end-to-end **typed sale plus previous-month summary**
slice from the approved brief. Voice, inventory deduction, expenses, roles, RAG, graphs, provider
failover, and paid-plan gating are not included. Any unresolved decision about taxes, stock ownership,
future tenant roles, or expanded money semantics must be returned to the owner as a focused product
question rather than guessed in code.

## Related sources

- [Pisto engineering workflow](engineering-workflow.md)
- [Approved AI-native product brief](product-briefs/pisto-ai-business-assistant.md)
- [AI assistant architecture](ai-assistant.md)
- [Pisto architecture](architecture.md)
- [OpenAI project instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [OpenAI Codex skills](https://learn.chatgpt.com/docs/build-skills)
