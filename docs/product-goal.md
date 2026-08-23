# Active product goal

- Status: **operating core V1 partly delivered: catalog/inventory, expenses/cash, and
  customers/receivables are implemented and locally validated alongside sales and sale correction;
  reports, assistant, and voice are not implemented**
- Owner: **repository owner**
- Last reviewed: **2026-08-23**

## Goal

Turn the validated Pisto platform foundation into a **complete modular operating core** that works
through the shared web, iOS, and Android architecture.

The milestone adds catalog/inventory, expenses/cash, customers/receivables, exact reports,
provider-neutral text assistance with narrow tools, and bounded push-to-talk transcription around
the manual sales foundation. The first three are implemented and locally validated; exact reports,
the assistant, and voice are not. Each capability keeps a complete structured path, and AI remains an
interface over deterministic commands and queries rather than a source of truth.

The frozen data/action contracts and exclusions for this milestone are in
[Operating core V1 capability contracts](product-slices/operating-core-v1.md). The long-term product
definition remains [Pisto AI-native business assistant](product-briefs/pisto-ai-business-assistant.md),
and composition follows [Product capability architecture](product-capability-architecture.md).

## What is already established

- The repository has explicit boundaries for a universal Expo client, Hono API, transport contracts,
  PostgreSQL/Drizzle persistence, Better Auth, provider-neutral entitlements, and deployment seams.
- [Sales Increment 1](sales-increment-1.md) implements one organization-backed owner business,
  total-only manual sale review/confirmation, canonical result, previous-month summary, and
  transactional void/replacement correction. No `GET /v1/sales` list exists, so correction cannot be
  reached for a sale the user has navigated away from.
- The [catalog/inventory](product-slices/catalog-inventory-v1.md),
  [expenses/cash](product-slices/expenses-cash-v1.md), and
  [customers/receivables](product-slices/customers-receivables-v1.md) slices are implemented, mounted
  under `/v1`, reachable from the `/operate` module hub, and covered by the PostgreSQL integration
  suites. Their schema ships in migration `0003_worried_weapon_omega.sql`.
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
10. Which existing capability owns it, where is its structured/manual path, and how is it discovered
    without adding a disconnected top-level control?

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

## Active delivery sequence

The catalog/inventory, expenses/cash, and customers/receivables contracts in
[Operating core V1](product-slices/operating-core-v1.md) were implemented in isolated capability
branches and integrated through the explicit app/API composition roots. What remains, in order:

1. `GET /v1/sales` and the screen that uses it, so the implemented correction flow becomes reachable
   for a past sale;
2. exact operating reports behind the existing `packages/contracts/src/reports.ts` contract;
3. the provider-neutral text assistant; then
4. bounded push-to-talk voice.

Deployment, store submission, RAG/graphs, silent provider fallback, and a production-release claim
remain excluded. Nothing in this milestone is pushed to `origin/main`, deployed, or released.

## Related sources

- [Pisto engineering workflow](engineering-workflow.md)
- [Approved AI-native product brief](product-briefs/pisto-ai-business-assistant.md)
- [Product capability architecture](product-capability-architecture.md)
- [Operating core V1 capability contracts](product-slices/operating-core-v1.md)
- [AI assistant architecture](ai-assistant.md)
- [Pisto architecture](architecture.md)
- [OpenAI project instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [OpenAI Codex skills](https://learn.chatgpt.com/docs/build-skills)
