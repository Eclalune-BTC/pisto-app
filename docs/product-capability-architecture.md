# Product capability architecture

- Status: **accepted product and composition direction; capabilities remain individually gated**
- Last reviewed: **2026-08-22**
- Applies to: product modules, navigation, shared UI, assistant tools, voice, and parallel delivery

Pisto is intended to grow into a complete operating product for Spanish-speaking entrepreneurs, not
a collection of disconnected forms or assistant demos. Growth must preserve one understandable
product, trustworthy records, and clear ownership for the engineers and agents who extend it.

This document defines how future capabilities fit together. It does not approve every capability for
implementation. The active milestone is the bounded operating core in
[Active product goal](product-goal.md), with its frozen capability contracts in
[Operating core V1](product-slices/operating-core-v1.md).

## Competitive direction

Treinta's current public product surface covers sales, inventory, variants, catalogs, reports,
employees and permissions, suppliers and purchases, barcodes, digital receipts, and synchronized
mobile/web use. That is useful market context, not an instruction to copy its interface or build a
feature checklist in parallel.

Pisto should compete on two dimensions:

1. cover the daily operating jobs an entrepreneur actually needs; and
2. make those jobs faster through trustworthy conversational execution, while keeping every result
   inspectable, editable, and available through structured UI.

“More complete than Treinta” therefore means deeper useful workflows and stronger data confidence,
not a larger number of unfinished menu entries. Every capability below must pass its own product
brief, dependency, data-integrity, permission, UI, and release gates.

## Architecture stance: a modular monolith

Pisto remains one product client, one API composition root, and one primary PostgreSQL database until
measured scale, reliability, deployment, or team ownership requires another runtime boundary.

A **capability slice** owns one coherent business job across the necessary layers:

```text
user job
  -> screen or assistant entry
  -> transport contract
  -> authorized command or query
  -> domain policy and calculation
  -> transaction/repository
  -> canonical record and audit
```

The slice is conceptual before it is a package. Keep code in an existing owner while it is local and
cohesive. Create a focused workspace only when independent invariants, reuse across multiple routes,
or sustained change pressure justify it. Do not create empty `sales`, `inventory`, `voice`, or
`shared` packages in anticipation of future work.

Applications own composition. A capability does not self-register routes, navigation, tools, jobs,
or permissions through a generic plugin registry. Explicit composition keeps the product map,
authorization surface, and production behavior reviewable.

## Capability map

The map is a dependency guide, not a promise that every row is approved or implemented.

| Layer | Capabilities | Ownership rule |
| --- | --- | --- |
| Identity and trust | Account verification/recovery, business workspace, membership, roles, sessions, audit | Better Auth proves identity/membership; Pisto policy authorizes product actions |
| Commercial records | Catalog, prices, sales, corrections, receipts, customers | Canonical records and money calculations live in deterministic domain code and PostgreSQL |
| Supply and stock | Suppliers, purchases, product variants, stock movements, adjustments, alerts, barcode lookup | Inventory is a movement ledger; a displayed quantity is derived, not independently edited truth |
| Cash and obligations | Payment methods, expenses, cash movements, receivables, payables, close/reconciliation | Revenue, cash, debt, cost, margin, and profit remain distinct concepts |
| Insight | Period summaries, reports, exports, anomaly/attention cues, business questions | Exact relational queries produce facts; presentation and AI explain but do not recalculate them |
| Interaction channels | Structured UI, assistant text, push-to-talk, optional spoken output, import/export, scanner/camera | Every channel calls the same authorized commands and queries through a narrow adapter |
| Commercial access | Plans, entitlements, usage/metering when approved | Provider state normalizes to Pisto entitlements; billing never becomes domain truth |
| Operations | Observability, idempotent jobs, backups, retention, support/admin | Operational capability is shipped only with deployment evidence and least-privilege controls |

## Capability slice contract

Before adding a material feature, its brief must answer all of these questions:

| Concern | Required decision |
| --- | --- |
| User job | One observable task or decision, primary actor, start, and persisted or visible end |
| Prerequisites | Existing capabilities and records it depends on; no hidden cross-module assumption |
| Data owner | Canonical records, derived views, retention, correction/void behavior, and audit evidence |
| Money and time | Currency, precision, tax/cost meaning, IANA time zone, and period-boundary rules |
| Commands | Authorized state changes, validation, idempotency, transaction, and conflict behavior |
| Queries | Exact filters, tenant scope, empty/error distinction, pagination, and freshness |
| Permissions | Server-resolved actor/business, named action policy, denied behavior, and UI visibility |
| Product surfaces | Structured/manual flow, discoverability, contextual actions, and responsive states |
| Assistant tools | Narrow read or draft/action tools, confirmation policy, and deterministic result contract |
| Platform adapters | Only real differences such as audio, camera, scanner, stores, files, or navigation chrome |
| Failure model | Loading, empty, invalid, denied, offline, timeout, retry, partial failure, and recovery |
| Evidence | Tests, representative evaluations, rendered/device checks, provider sandbox, and release gates |
| Non-goals | Adjacent modules and speculative flexibility deliberately excluded |

If these answers are not stable enough to test, the feature is not ready to distribute among writing
agents.

## Data and module interaction rules

- Every business record is scoped to the server-resolved `businessId`; a client, model, transcript,
  or active-organization selector does not authorize an action.
- One capability owns each canonical write model. Another capability requests an explicit command or
  reads an explicit query; it does not update the owner's tables as a shortcut.
- Synchronous invariants that must succeed together use one explicit transaction composed by the
  owning application/domain boundary. For example, a confirmed catalog sale can append a sale and
  its stock movements atomically once that stock behavior is approved.
- Cross-capability screens use explicit read composition or a named read model. They do not force
  every capability into one universal record type or query builder.
- Add a durable event/outbox only when a real asynchronous consumer, retry requirement, or external
  side effect exists. Do not introduce a generic event bus for imagined modules.
- Corrections append or reference auditable changes. Financial and inventory history is not silently
  rewritten to make current totals convenient.
- API contracts expose product meaning, not Drizzle rows, provider payloads, or AI SDK objects.
- Shared code must have a clear semantic owner. `shared`, `common`, `helpers`, and generic service
  layers are not default destinations.

## Product shell and information architecture

Top-level navigation represents durable user jobs, not every module. The current
`Home / Billing / Settings` shell is working scaffold navigation, not the final Pisto information
architecture.

One small information-architecture hypothesis to validate with real product slices is:

- **Home:** business status, attention, and the next useful action backed by real data;
- **Operate:** sales, purchases, inventory, customers, suppliers, and other daily structured work;
- **Assistant:** text and voice entry plus reviewable history of assistant requests/results;
- **Account access:** business switcher, team, settings, billing, and security outside the daily-work
  destinations.

This is a candidate composition model, not final copy or approval for empty destinations. Before
changing labels or route topology, validate that users can find the real jobs and that every primary
destination has owned content. The approved first slice requires Operate/Sales and Assistant entry;
Home earns a slot only after a brief defines real orientation, attention, or next-action content. Do
not invent dashboard metrics or planning content to fill it. Surface the previous-month summary
contextually from Assistant and Sales/Operate. Promote Reports only after an approved brief proves
multiple recurring report jobs and direct-entry value. On compact native and web layouts, keep no
more than three to five durable destinations; fewer are valid. Wide web may expose nested module
links and contextual secondary navigation without changing product meaning.

The manual increment uses neutral Latin American Spanish copy with Salvadoran `es-SV` money/date
formatting as its explicit initial product choice. Validate it with Salvadoran terminology and users
before release. Source code and repository documentation remain English. The typed `es-SV` catalog
separates presentation from logic without claiming a second language; a second locale, selector, and
preference synchronization remain separately briefed capabilities. See [ADR 0013](adrs/0013-es-sv-localization-boundary.md).

Do not place one permanent tab per capability. Do not turn Home into a grid of feature cards. New
capabilities enter the shell only when they introduce a durable user job; otherwise they live inside
an existing area, contextual action, record detail, search result, or assistant tool.

Billing and settings are important but not primary daily work. They remain reachable from account or
business context and may stay directly addressable by URL.

## UI composition and action rules

A complete product screen contains context, content, state, and actions that belong together. A
button is allowed only when its owner and effect are clear.

Every action must define:

- the user intent and record/context it acts on;
- its destination or server effect;
- primary, secondary, destructive, or passive hierarchy;
- enabled, disabled, loading, success, error, retry, cancellation, and duplicate-tap behavior as
  applicable; and
- its keyboard, focus, screen-reader, and touch-target behavior.

Use one primary action per decision region. A global “register” or “create” entry may open a short,
task-based action chooser, but it cannot become an unowned floating button that accumulates unrelated
features. Record-specific actions belong with the record. Destructive or irreversible actions show
the exact effect and use the approved confirmation policy.

Use type, spacing, alignment, dividers, and state before adding containers. Cards, pills, icon tiles,
shadows, and illustrations remain justified only by grouping, interaction, hierarchy, feedback,
state, or established brand character. Pisto's current ink/lime/cream direction is the baseline; no
glow is needed to communicate modern software.

## Shared web and native contract

Share product semantics rather than forcing pixel identity:

- design tokens, typography, icon meaning, copy vocabulary, contracts, domain components, validation,
  state policy, permissions, and analytics event meaning stay shared;
- responsive React Native components handle ordinary density and layout changes;
- `.web.tsx`, `.native.tsx`, `.ios.tsx`, or `.android.tsx` adapters handle genuine capability or
  interaction differences;
- a platform adapter returns a typed capability result, not a second business workflow; and
- platform-specific navigation chrome may differ while destinations, route meaning, and access policy
  remain aligned.

A “shared component” must encode stable semantics. Do not build one giant configurable screen or
universal component with dozens of flags merely to maximize reuse.

## Assistant and voice expansion

The assistant is a second way to operate Pisto, not a replacement for understandable structured UI.
Every mutation-capable assistant tool maps to an existing Pisto command and every factual answer maps
to an authorized query. If AI is disabled or unavailable, canonical records remain usable manually.

Voice expands in measured stages:

1. typed assistant over the first proven command/query;
2. short push-to-talk recording that returns an editable transcript to that same composer;
3. optional streaming transcription when latency measurements justify a live partial transcript;
4. optional text-to-speech for selected responses; and
5. full duplex/realtime conversation only after interruption, latency, privacy, cost, device, and
   accessibility evaluations justify the added system.

ElevenLabs is a candidate adapter, not an architectural owner. Its current realtime speech-to-text
API supports client single-use tokens, and its Speech Engine can bring voice to a server-owned LLM.
Neither changes Pisto's authorization, tool, confirmation, data, provider-registry, or audit rules.
Provider credentials stay server-side; raw audio and transcripts receive the retention treatment in
[AI assistant architecture](ai-assistant.md) and the staged gates in
[Voice architecture](voice-architecture.md).

Speech input and speech output are separate capabilities. Pisto can choose, evaluate, replace, or
disable an STT or TTS provider independently without changing sale, inventory, or report code. There
is no automatic provider fallback: an unavailable voice provider produces an explicit degraded state
and leaves text/manual paths available.

## Delivery sequence and dependency gates

The sequence favors coherent operating loops over breadth:

| Stage | Outcome | Gate before expansion |
| --- | --- | --- |
| 0. Trust foundation | Verified/recoverable account, truthful business selection, hardened organization boundary | End-to-end auth and cross-tenant tests; product data cannot be orphaned or exposed |
| 1. Sales loop | Create, review, confirm, list, correct/void, and summarize sales | Idempotent audited money records and representative Spanish assistant evaluations |
| 2. Voice entry | Speak the same sale/report jobs and edit the transcript | Permission, format, privacy, latency, provider-error, device, and cost evidence |
| 3. Catalog and stock | Products/variants, purchases, stock movements, sale deduction, low-stock attention | Movement-ledger invariants, concurrency tests, correction effects, and usable manual flows |
| 4. Expenses and cash | Expenses, payment methods, cash movements, close, cost foundations | Reconciliation rules and truthful revenue/cash/cost/margin terminology |
| 5. Relationships | Customers, suppliers, receivables, payables, history | Contact privacy, balances, settlement/correction, and authorization policy |
| 6. Team | Invitations and task-level owner/manager/cashier/accountant permissions | Verified invitation delivery, least privilege, role matrix, session revocation, and audit |
| 7. Insight and reach | Deeper reports, exports, catalog sharing, receipts, barcode/scanner, useful automation | Each channel's security, localization, platform, and external-policy brief |
| 8. Locale/fiscal expansion | Country-specific invoices, taxes, compliance, and integrations | Legal/accounting owner, locale-specific model, external certification, and release evidence |

Stages may overlap only when their prerequisites and file ownership are explicit. They do not
authorize speculative schemas, generic workflow engines, autonomous financial actions, RAG, graph
storage, or microservices.

## Multi-agent delivery contract

For a material capability:

1. one lead owns the user job, capability contract, architecture decisions, integration, and final
   evidence;
2. independent agents may research the repository, primary sources, UX, privacy/threats, and test
   gaps in parallel;
3. the lead resolves open product/data/permission decisions and freezes the public contract before
   parallel writing starts;
4. each writer receives a separate worktree/branch, disjoint file ownership, named acceptance
   criteria, and a stopping condition;
5. one integration owner reviews complete commits and runs the combined gates; and
6. an independent read-only reviewer tries to falsify correctness, state truth, accessibility,
   authorization, failure behavior, and unnecessary abstraction from the full diff.

Multiple agents must not independently invent competing contracts or edit the same vertical slice in
one worktree. Codex and Claude Code can follow the same repository contract, but neither runtime is
claimed or coordinated unless the operator or an explicit harness actually launched it.

## Adding a future feature

A new engineer or agent should:

1. read the active goal, this document, the feature prompt, workflow, relevant domain guide, and ADRs;
2. inspect the real code and rendered UI and classify current capability state;
3. complete the capability slice contract and name prerequisites/non-goals;
4. choose the existing owner or justify a new focused package;
5. design the structured/manual path first, then map assistant and platform adapters to it;
6. implement one end-to-end outcome with truthful failure states;
7. validate contracts, authorization, data integrity, responsive/device UI, and provider behavior;
8. commission independent review; and
9. update the capability state without claiming deployment or release from local evidence.

## Primary sources

- [Treinta inventory and sales](https://treinta.co/software-inventario-ventas)
- [Treinta current feature overview](https://treinta.co/mx/funcionalidades)
- [Expo Router navigation layouts and platform-specific tabs](https://docs.expo.dev/router/basics/navigation-layouts/)
- [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/)
- [ElevenLabs realtime speech-to-text](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime)
- [ElevenLabs Speech Engine](https://elevenlabs.io/docs/overview/capabilities/speech-engine)
- [Vercel AI SDK provider registry](https://ai-sdk.dev/docs/reference/ai-sdk-core/provider-registry)
- [Vercel AI SDK tools and tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling)
- [OpenAI Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
