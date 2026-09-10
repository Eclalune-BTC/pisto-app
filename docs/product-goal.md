# Active product goal

- Status: **operating core V1 partly delivered: catalog/inventory, expenses/cash, and
  customers/receivables are implemented and locally validated alongside sales and sale correction;
  bounded sale history and exact operating reports are implemented; assistant and voice remain absent**
- Owner: **repository owner**
- Last reviewed: **2026-09-10**

## Goal

Turn the validated Pisto platform foundation into a **complete modular operating core** that works
through the shared web, iOS, and Android architecture.

The milestone adds catalog/inventory, expenses/cash, customers/receivables, exact reports,
provider-neutral text assistance with narrow tools, and bounded push-to-talk transcription around
the manual sales foundation. The manual capabilities, including sale history and exact reports, are
implemented and locally validated; the assistant and voice are not. Each capability keeps a complete
structured path, and AI remains an
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
  transactional void/replacement correction. The bounded `GET /v1/sales` history and its status
  filter make past sales and their correction actions reachable from `/operate/sales`.
- The [catalog/inventory](product-slices/catalog-inventory-v1.md),
  [expenses/cash](product-slices/expenses-cash-v1.md), and
  [customers/receivables](product-slices/customers-receivables-v1.md) slices are implemented, mounted
  under `/v1`, reachable from the `/operate` module hub, and covered by the PostgreSQL integration
  suites. Their schema ships in migration `0003_worried_weapon_omega.sql`.
- Exact operating reports are implemented at `GET /v1/reports/operating` and `/operate/reports`.
  One authorized repeatable-read transaction separates period flows from current positions.
- Fresh-session checks, consistent command lock ordering, exact timestamp cursors, and migration
  `0005` strengthen the existing data model. Product requests share a PostgreSQL-backed rate budget,
  and `PRODUCT_WRITES_ENABLED=false` pauses business changes while reads remain available.
- The owner's latest instruction is local-only: Expo and Bun/Hono use local PostgreSQL 18 through
  postgres-js and Drizzle. Neon is an optional future preference; hosting is undecided and no
  publication is authorized. The portable web export and Bun/Hono container remain. See
  [ADR 0017](adrs/0017-portable-postgres-and-hosting.md).
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
branches and integrated through the explicit app/API composition roots. Sale history and exact
operating reports are also implemented. Complete the manual-core audit, usability, data-integrity,
and local runtime acceptance work before introducing the provider-neutral text assistant and then bounded
push-to-talk voice.

The latest owner instruction withdraws hosting/publication work and requires everything to run
locally under the revised ADR 0017. [Release evidence](release-evidence.md) records local validation
and verification of withdrawal of the earlier unwanted publication; this goal does not claim that
remote resources have been removed. Future hosting requires an explicit new decision. Store
submission, email delivery, team workflows, RAG/graphs,
silent provider fallback, and AI/voice completion require their own remaining implementation and
acceptance gates.

## Related sources

- [Pisto engineering workflow](engineering-workflow.md)
- [Approved AI-native product brief](product-briefs/pisto-ai-business-assistant.md)
- [Product capability architecture](product-capability-architecture.md)
- [Operating core V1 capability contracts](product-slices/operating-core-v1.md)
- [AI assistant architecture](ai-assistant.md)
- [Pisto architecture](architecture.md)
- [OpenAI project instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)
- [OpenAI Codex skills](https://learn.chatgpt.com/docs/build-skills)
