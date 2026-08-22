# ADR 0011: Modular capabilities and app-owned composition

- Status: Accepted
- Date: 2026-08-22
- Owners: product domains, `@pisto/app`, `@pisto/api`, `@pisto/contracts`, `@pisto/db`
- Supersedes: none
- Research recheck: product shell redesign, independent service extraction, or Expo navigation change

## Context

Pisto is expected to expand from its approved sale/report slice into inventory, purchases, expenses,
cash, customers, suppliers, team permissions, reports, and text/voice assistance. Adding each feature
as a route, card, button, or isolated service would produce a flat product, duplicate business rules,
and make parallel delivery conflict-prone.

The repository is currently a small monorepo with one universal Expo client, one Hono API, explicit
contract/auth/billing/database packages, and one PostgreSQL source of truth. There is no measured
deployment, scale, reliability, or team-ownership reason to distribute product domains across
microservices. There is also no stable set of third-party product modules that requires a runtime
plugin system.

Expo Router supports shared file-based navigation and platform-specific navigation composition where
native and web chrome genuinely differ. That permits shared product semantics without forcing one
pixel-identical shell.

## Decision

- Pisto uses a modular monolith for product capabilities. One client and API compose explicit
  capability slices around a primary PostgreSQL source of truth.
- A capability is defined by its user job, data owner, commands, queries, authorization policy,
  product surfaces, assistant tools, platform adapters, failure model, tests, and non-goals.
- A capability does not automatically require a workspace package. Code stays in the smallest
  existing owner until independent invariants, cross-route reuse, or sustained change pressure
  justifies extraction.
- `@pisto/app` and `@pisto/api` are composition roots. Modules do not self-register routes,
  navigation, tools, jobs, events, or permissions through a generic plugin framework.
- Top-level navigation represents a small stable set of user jobs. New modules normally compose
  inside an existing product area rather than receiving a new permanent tab.
- The first real native shell uses the already-installed stable Expo Router JavaScript `Tabs`; web
  uses an explicit platform-resolved layout backed by the same typed destination model. Experimental
  native/custom tabs or another navigation dependency require a demonstrated need and fresh review.
- Shared web/native code owns semantics, tokens, validation, copy vocabulary, domain components, and
  state rules. Narrow platform-resolved adapters own real differences such as navigation chrome,
  microphone, camera/scanner, files, and store purchase entry.
- Cross-capability synchronous invariants use explicit commands/queries and transactions. Add a
  durable event/outbox only when a real asynchronous consumer or retry boundary exists.
- The assistant and voice layers call the same authorized commands and queries as structured UI.
  They cannot become alternative sources of business truth.

## Consequences

- New features have a repeatable place in the product and code without prebuilding a generic ERP
  framework.
- Navigation remains understandable as the capability count grows.
- Web and native can use appropriate interaction chrome while preserving product meaning.
- The API composition root may initially contain more explicit wiring. This is intentional and easier
  to audit than implicit registration.
- A future service extraction requires evidence about independent scaling, failure isolation,
  deployment cadence, compliance, or durable team ownership and a superseding ADR.
- A future package extraction must move coherent ownership, not only shorten imports.

## Alternatives considered

- **Feature plugin framework:** rejected because Pisto has no third-party runtime modules or stable
  plugin contract; it would hide routes, permissions, and tool exposure behind premature machinery.
- **Microservice per future domain:** rejected because it adds network consistency, deployment,
  observability, authorization propagation, and data ownership costs without measured need.
- **Flat route-oriented application:** rejected because routes would own duplicated business policy
  and cross-module writes would become difficult to audit.
- **One universal configurable screen/component:** rejected because flag-heavy reuse obscures semantic
  ownership and genuine platform differences.
- **One permanent tab per module:** rejected because navigation complexity would grow with the schema
  rather than with stable user jobs.

## Validation

- The first sale/report slice must demonstrate the capability contract across structured UI,
  assistant proposal/confirmation, API contract, authorized domain command/query, persistence, and
  audit without a generic plugin layer.
- Responsive verification must confirm aligned destinations and product meaning on compact native,
  compact web, and wide web while allowing platform-specific chrome.
- Descendant routes must preserve the selected parent destination, and web routes must expose correct
  links, one meaningful page heading, and named main/navigation landmarks as applicable.
- An inventory slice must prove that a second capability composes through explicit commands/queries
  and does not update sales-owned records or duplicate assistant logic.
- Any proposed package, event bus, outbox, service, or new top-level destination must identify the
  concrete ownership, consumer, failure, scale, or discoverability pressure it solves.
- Material changes receive independent architecture, authorization, failure-state, accessibility,
  and unnecessary-abstraction review.

## Official sources

- [Expo Router navigation layouts](https://docs.expo.dev/router/basics/navigation-layouts/)
- [Expo Router introduction](https://docs.expo.dev/router/introduction/)
- [Expo Router JavaScript tabs](https://docs.expo.dev/router/advanced/tabs/)
- [Expo Router platform-specific extensions](https://docs.expo.dev/router/advanced/platform-specific-modules/)
- [OpenAI Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
